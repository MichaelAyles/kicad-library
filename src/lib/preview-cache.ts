/**
 * Shared in-memory cache for preview schematics
 * This is used by both /api/preview and /api/preview/[filename] routes
 */

export interface PreviewCacheEntry {
  sexpr: string;
  timestamp: number;
}

// Global cache shared across all preview API routes
export const previewCache = new Map<string, PreviewCacheEntry>();

// Clean up old previews (older than 1 hour)
export function cleanupOldPreviews() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, data] of previewCache.entries()) {
    if (data.timestamp < oneHourAgo) {
      previewCache.delete(id);
    }
  }
}
