import type { Context } from "hono";
import type { AppEnv } from "./env";

/**
 * Handler for requests no API route matched.
 *
 * Static assets are served before the worker runs, so this only sees misses
 * (and unknown /api/* paths). For now it defers to the asset binding, which
 * applies the static site's own 404 handling. Page fallbacks (e.g. dynamic
 * circuit pages) belong here.
 */
export function serveAssetFallback(c: Context<AppEnv>): Promise<Response> {
  return c.env.ASSETS.fetch(c.req.raw);
}
