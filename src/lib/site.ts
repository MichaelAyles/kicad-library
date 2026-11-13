/**
 * Canonical public origin of the site, used for canonical URLs, Open Graph
 * tags, attribution and the sitemap. The apex domain redirects to www, so www
 * is canonical.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.circuitsnips.com"
).replace(/\/+$/, "");

/**
 * Absolute canonical URL of a circuit page. Slugs are generated as
 * [a-z0-9-] so encoding is a no-op today; it keeps any odd slug a valid URL
 * and identical across canonical tags, the sitemap and attribution.
 */
export function circuitUrl(slug: string): string {
  return `${SITE_URL}/circuit/${encodeURIComponent(slug)}`;
}
