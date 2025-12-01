/**
 * Thumbnail URL utilities
 *
 * Transforms Supabase Storage URLs to R2 URLs dynamically,
 * no database migration required.
 */

const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  "https://pub-5cfb1ad5b22e451db2e5711b584b49c9.r2.dev";

/**
 * Transform a thumbnail URL from Supabase Storage to R2
 *
 * Supabase format: .../thumbnails/{userId}/{circuitId}-v{version}-{theme}.png
 * R2 format: .../thumbnails/{circuitId}/{theme}.png
 */
export function toR2ThumbnailUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  // Already an R2 URL? Return as-is
  if (url.includes("r2.dev")) {
    return url;
  }

  // Not a Supabase storage URL? Return as-is
  if (!url.includes("supabase.co/storage")) {
    return url;
  }

  try {
    // Extract circuit ID and theme from Supabase URL
    // Pattern: /thumbnails/{userId}/{circuitId}-v{version}-{theme}.png
    const match = url.match(
      /\/thumbnails\/[^/]+\/([a-f0-9-]+)-v\d+-(light|dark)\.png/i,
    );

    if (match) {
      const [, circuitId, theme] = match;
      return `${R2_PUBLIC_URL}/thumbnails/${circuitId}/${theme}.png`;
    }

    // Fallback: return original URL if pattern doesn't match
    return url;
  } catch {
    return url;
  }
}

/**
 * Get both light and dark R2 thumbnail URLs for a circuit ID
 */
export function getR2ThumbnailUrls(circuitId: string): {
  light: string;
  dark: string;
} {
  return {
    light: `${R2_PUBLIC_URL}/thumbnails/${circuitId}/light.png`,
    dark: `${R2_PUBLIC_URL}/thumbnails/${circuitId}/dark.png`,
  };
}
