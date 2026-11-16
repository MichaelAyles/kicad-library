import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cache public GET responses in Cloudflare's edge cache.
 *
 * On Workers the CDN doesn't cache what a worker returns, so `s-maxage`
 * headers alone do nothing: every request would reach Supabase. This wrapper
 * stores responses in the Workers Cache API, keyed by the full URL (including
 * the query string), for as long as their own Cache-Control allows.
 *
 * Only responses that are already marked public with an `s-maxage` are
 * stored, so error responses (`no-store`) are never cached. Outside Workers
 * (next dev, CI) `caches.default` doesn't exist and the handler runs as-is.
 * The Cache API is a no-op on *.workers.dev; it works on custom domains.
 */
export function withEdgeCache<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, ...args: Args) => Promise<Response>,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const cache = (globalThis as { caches?: { default?: Cache } }).caches
      ?.default;
    if (!cache || request.method !== "GET") {
      return handler(request, ...args);
    }

    const key = new Request(request.url, { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return hit;

    const response = await handler(request, ...args);
    if (isCacheable(response)) {
      const put = cache.put(key, response.clone()).catch((error) => {
        console.warn("edge cache put failed:", error);
      });
      try {
        getCloudflareContext().ctx.waitUntil(put);
      } catch {
        await put;
      }
    }
    return response;
  };
}

function isCacheable(response: Response): boolean {
  if (response.status !== 200 && response.status !== 302) return false;
  if (response.headers.has("Set-Cookie")) return false;
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  return /\bpublic\b/.test(cacheControl) && /\bs-maxage=\d+/.test(cacheControl);
}
