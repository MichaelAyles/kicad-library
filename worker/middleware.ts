/**
 * Cross-cutting middleware: per-IP rate limiting (port of src/middleware.ts)
 * and the Workers Cache API edge cache (port of src/lib/edge-cache.ts).
 */

import type { Context, MiddlewareHandler } from "hono";
import {
  checkRateLimit,
  RateLimitPresets,
  type RateLimitConfig,
} from "../src/lib/rate-limit";
import type { AppEnv } from "./env";

/**
 * Public read-only routes served from the edge cache. They were excluded
 * from the Next middleware matcher too, so cached hits never count against
 * a client's limit.
 */
export function isRateLimitExempt(path: string): boolean {
  return (
    path === "/api/search" ||
    path === "/api/stats" ||
    path === "/api/tags" ||
    path.startsWith("/api/schematic/")
  );
}

/** Client IP: cf-connecting-ip is set by Cloudflare and can't be spoofed. */
export function clientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}

/**
 * One counter per IP across the API (30 req/min by default). In-memory per
 * isolate, so it is a per-instance limit, not a global one.
 */
export function rateLimit(
  config: RateLimitConfig = RateLimitPresets.MODERATE,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (isRateLimitExempt(c.req.path)) return next();

    const result = checkRateLimit(`api:default:${clientIp(c)}`, config);
    const headers = {
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": result.reset.toString(),
    };

    if (!result.success) {
      return c.json(
        {
          error: "Too Many Requests",
          message: "You have exceeded the rate limit. Please try again later.",
          limit: result.limit,
          reset: new Date(result.reset).toISOString(),
        },
        429,
        {
          ...headers,
          "Retry-After": Math.ceil(
            (result.reset - Date.now()) / 1000,
          ).toString(),
        },
      );
    }

    await next();
    setHeaders(c, headers);
  };
}

/**
 * Set headers on the response. Responses from fetch() (the ASSETS binding,
 * the Cache API) have immutable headers, so copy those first.
 */
function setHeaders(c: Context, headers: Record<string, string>) {
  try {
    for (const [name, value] of Object.entries(headers)) {
      c.res.headers.set(name, value);
    }
  } catch {
    const copy = new Response(c.res.body, c.res);
    for (const [name, value] of Object.entries(headers)) {
      copy.headers.set(name, value);
    }
    c.res = copy;
  }
}

/** Run a promise after the response, or await it outside Workers (tests). */
export function waitUntil(c: Context, promise: Promise<unknown>): Promise<void> {
  try {
    c.executionCtx.waitUntil(promise);
    return Promise.resolve();
  } catch {
    return promise.then(() => undefined);
  }
}

function isCacheable(response: Response): boolean {
  if (response.status !== 200 && response.status !== 302) return false;
  if (response.headers.has("Set-Cookie")) return false;
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  return /\bpublic\b/.test(cacheControl) && /\bs-maxage=\d+/.test(cacheControl);
}

/**
 * Cache public GET responses in Cloudflare's edge cache.
 *
 * Workers responses aren't cached by the CDN, so `s-maxage` alone does
 * nothing. This stores responses in the Workers Cache API, keyed by the full
 * URL (including the query string), for as long as their own Cache-Control
 * allows. Only responses already marked public with an `s-maxage` are stored,
 * so errors (`no-store`) never are. Where `caches.default` doesn't exist
 * (tests) the handler runs as-is. The Cache API is a no-op on *.workers.dev.
 */
export function edgeCache(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const cache = (globalThis as { caches?: { default?: Cache } }).caches
      ?.default;
    if (!cache || c.req.method !== "GET") return next();

    const key = new Request(c.req.url, { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return hit;

    await next();
    if (isCacheable(c.res)) {
      const put = cache.put(key, c.res.clone()).catch((error) => {
        console.warn("edge cache put failed:", error);
      });
      await waitUntil(c, put);
    }
  };
}
