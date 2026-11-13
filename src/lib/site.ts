/**
 * Canonical public origin of the site, used for canonical URLs, Open Graph
 * tags and the sitemap. The apex domain redirects to www, so www is canonical.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.circuitsnips.com"
).replace(/\/+$/, "");
