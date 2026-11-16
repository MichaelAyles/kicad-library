import type { Context } from "hono";
import type { AppEnv } from "./env";

/**
 * Pages for circuits that weren't pre-built.
 *
 * The static export builds /circuit/<slug> for every public circuit, plus a
 * shell page for the placeholder slug "_" (see src/lib/shell-slug.ts) and the
 * edit page only for "_". Requests for any other circuit (one created or
 * made public since the last build, a private one, or any edit page) miss
 * the static assets and land here, and get the shell, which reads the real
 * slug from the URL and loads the circuit in the browser.
 *
 * Matches the HTML page and the `.txt` RSC payload Next fetches for
 * client-side navigation:
 *   /circuit/<slug>            -> /circuit/_
 *   /circuit/<slug>.txt        -> /circuit/_.txt
 *   /circuit/<slug>/edit       -> /circuit/_/edit
 *   /circuit/<slug>/edit.txt   -> /circuit/_/edit.txt
 */
const SHELL_SLUG = "_";
const CIRCUIT_PAGE = /^\/circuit\/([^/]+?)(\/edit)?(\.txt)?\/?$/;

export function shellPathFor(pathname: string): string | null {
  const match = CIRCUIT_PAGE.exec(pathname);
  if (!match) return null;
  const [, slug, edit = "", ext = ""] = match;
  if (slug === SHELL_SLUG && !edit && !ext) return null; // already the shell
  return `/circuit/${SHELL_SLUG}${edit}${ext}`;
}

/**
 * Handler for requests no API route matched. Static assets are served before
 * the worker runs, so this only sees misses.
 */
export async function serveAssetFallback(c: Context<AppEnv>): Promise<Response> {
  const url = new URL(c.req.url);

  if (url.pathname.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }

  if (c.req.method === "GET" || c.req.method === "HEAD") {
    const shell = shellPathFor(url.pathname);
    if (shell) {
      const shellUrl = new URL(shell, url);
      shellUrl.search = url.search;
      const response = await c.env.ASSETS.fetch(
        new Request(shellUrl, c.req.raw),
      );
      if (response.ok) {
        // Not the canonical page for this URL: keep it out of search indexes
        // until a rebuild gives the circuit its own page
        const headers = new Headers(response.headers);
        headers.set("X-Robots-Tag", "noindex");
        headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        return new Response(response.body, { status: 200, headers });
      }
    }
  }

  // Anything else: the site's 404 page with a 404 status
  const notFound = await c.env.ASSETS.fetch(new Request(new URL("/404", url)));
  if (!notFound.ok) return c.text("Not found", 404);
  return new Response(notFound.body, {
    status: 404,
    headers: notFound.headers,
  });
}
