/**
 * Centralized search utility for CircuitSnips
 * Uses weighted full-text search with ranking: tags > title > description
 * All search functionality should use this module for consistency
 */

export interface SearchCircuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  license: string;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
  view_count: number;
  copy_count: number;
  favorite_count: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export interface SearchOptions {
  query?: string;
  category?: string;
  tag?: string;
  license?: string;
  sort?: 'relevance' | 'recent' | 'popular' | 'views' | 'favorites';
  limit?: number;
  excludeImported?: boolean;
}

export interface SearchResponse {
  circuits: SearchCircuit[];
  count: number;
}

/**
 * Search circuits using weighted full-text search
 * Weights: Tags (highest) > Title (medium) > Description (lowest)
 *
 * @param options - Search parameters
 * @returns Search results with circuits and count
 *
 * @example
 * // Simple text search
 * const results = await searchCircuits({ query: 'amplifier' });
 *
 * // Search with filters
 * const filtered = await searchCircuits({
 *   query: 'atsamd',
 *   category: 'Power Supply',
 *   sort: 'popular',
 *   limit: 20
 * });
 *
 * // Tag search
 * const tagged = await searchCircuits({ tag: 'microcontroller' });
 */
export async function searchCircuits(options: SearchOptions = {}): Promise<SearchResponse> {
  try {
    const params = new URLSearchParams();

    // Add search query
    if (options.query?.trim()) {
      params.set('q', options.query.trim());
    }

    // Add filters
    if (options.category) params.set('category', options.category);
    if (options.tag) params.set('tag', options.tag);
    if (options.license) params.set('license', options.license);

    // Add sorting
    if (options.sort) params.set('sort', options.sort);

    // Add limit (default 50, max 100)
    const limit = Math.min(options.limit || 50, 100);
    params.set('limit', limit.toString());

    // Exclude imported circuits if requested
    if (options.excludeImported) params.set('excludeImported', 'true');

    const response = await fetch(`/api/search?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Search failed');
    }

    const data = await response.json();

    return {
      circuits: data.circuits || [],
      count: data.count || 0,
    };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

/**
 * Debounced search for autocomplete/live search
 * Returns a promise that resolves after the debounce delay
 *
 * @param query - Search query
 * @param limit - Number of results (default 5)
 * @param debounceMs - Debounce delay in milliseconds (default 300)
 * @returns Search results
 */
export async function debouncedSearch(
  query: string,
  limit: number = 5,
  debounceMs: number = 300
): Promise<SearchCircuit[]> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (query.trim().length < 2) {
        resolve([]);
        return;
      }

      try {
        const { circuits } = await searchCircuits({ query, limit });
        resolve(circuits);
      } catch (error) {
        console.error('Debounced search error:', error);
        resolve([]);
      }
    }, debounceMs);
  });
}

/**
 * Quick search for autocomplete (no debounce)
 * Use this when you handle debouncing in the component
 *
 * @param query - Search query
 * @param limit - Number of results (default 5)
 * @returns Search results
 */
export async function quickSearch(query: string, limit: number = 5): Promise<SearchCircuit[]> {
  if (query.trim().length < 2) {
    return [];
  }

  try {
    const { circuits } = await searchCircuits({ query, limit });
    return circuits;
  } catch (error) {
    console.error('Quick search error:', error);
    return [];
  }
}
