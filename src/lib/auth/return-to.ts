/**
 * Validate a post-sign-in return target: only same-origin URLs are allowed,
 * returned as an absolute URL (never rebuilt from the pathname, so a
 * "//evil.example" path can't turn into an off-site redirect). Anything else,
 * including unparseable values and other schemes, gives null.
 */
export function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== "string" || typeof window === "undefined") return null;
  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  return url.origin === window.location.origin ? url.href : null;
}
