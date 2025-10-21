/**
 * Shared in-memory LRU cache for preview schematics
 * This is used by both /api/preview and /api/preview/[filename] routes
 *
 * Uses LRU (Least Recently Used) eviction to prevent memory leaks:
 * - Maximum 100 previews cached
 * - Automatic eviction of oldest entries when full
 * - 1 hour TTL (time-to-live) for each entry
 *
 * This prevents unbounded memory growth in serverless functions
 */

import QuickLRU from 'quick-lru';

export interface PreviewCacheEntry {
  sexpr: string;
  timestamp: number;
}

// LRU cache with automatic eviction to prevent memory leaks
// maxSize: Maximum number of entries (100 previews)
// maxAge: TTL in milliseconds (1 hour = 3,600,000 ms)
export const previewCache = new QuickLRU<string, PreviewCacheEntry>({
  maxSize: 100,
  maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
});

/**
 * Manual cleanup function (now mostly handled by LRU automatically)
 * Kept for compatibility with existing code
 * @deprecated Use LRU's automatic eviction instead
 */
export function cleanupOldPreviews() {
  // LRU cache handles cleanup automatically via maxAge
  // This function is now a no-op but kept for backward compatibility
  previewCache.clear(); // Optional: force clear if needed
}
