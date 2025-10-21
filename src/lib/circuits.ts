import { createClient } from '@/lib/supabase/client';

export interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  user_id: string;
  file_path: string;
  raw_sexpr: string;
  tags: string[];
  category: string | null;
  license: string;
  view_count: number;
  copy_count: number;
  favorite_count: number;
  comment_count: number;
  is_public: boolean;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface CircuitsResponse {
  circuits: Circuit[];
  total: number;
}

const supabase = createClient();

export async function getCircuits(
  limit = 12,
  offset = 0,
  sortBy: 'copies' | 'recent' | 'favorites' = 'copies'
): Promise<CircuitsResponse> {
  try {
    let query = supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`,
        { count: 'exact' }
      )
      .eq('is_public', true)
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply sorting
    if (sortBy === 'copies') {
      query = query.order('copy_count', { ascending: false });
    } else if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'favorites') {
      query = query.order('favorite_count', { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      circuits: (data || []) as Circuit[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error fetching circuits:', error);
    throw error;
  }
}

export async function getCircuitBySlug(slug: string): Promise<Circuit | null> {
  try {
    const { data, error } = await supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data as Circuit;
  } catch (error) {
    console.error('Error fetching circuit:', error);
    throw error;
  }
}

/**
 * Search circuits using PostgreSQL full-text search
 * Uses the search_vector column with proper ranking
 */
export async function searchCircuits(
  query: string,
  limit = 12,
  offset = 0,
  filters?: {
    category?: string;
    tags?: string[];
    license?: string;
  }
): Promise<CircuitsResponse> {
  try {
    // Use the database's full-text search function for better performance
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_circuits', { search_query: query });

    if (searchError) throw searchError;

    if (!searchResults || searchResults.length === 0) {
      return { circuits: [], total: 0 };
    }

    // Get the IDs from search results
    const circuitIds = searchResults.map((r: { id: string }) => r.id);

    // Fetch full circuit data with filters
    let circuitQuery = supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`,
        { count: 'exact' }
      )
      .in('id', circuitIds)
      .eq('is_public', true);

    // Apply filters
    if (filters?.category) {
      circuitQuery = circuitQuery.eq('category', filters.category);
    }
    if (filters?.tags && filters.tags.length > 0) {
      circuitQuery = circuitQuery.overlaps('tags', filters.tags);
    }
    if (filters?.license) {
      circuitQuery = circuitQuery.eq('license', filters.license);
    }

    circuitQuery = circuitQuery
      .limit(limit)
      .range(offset, offset + limit - 1);

    const { data, error, count } = await circuitQuery;

    if (error) throw error;

    // Sort by search rank
    const rankedCircuits = (data || []).sort((a, b) => {
      const rankA = searchResults.find((r: { id: string }) => r.id === a.id)?.rank || 0;
      const rankB = searchResults.find((r: { id: string }) => r.id === b.id)?.rank || 0;
      return rankB - rankA;
    });

    return {
      circuits: rankedCircuits as Circuit[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error searching circuits:', error);
    throw error;
  }
}

/**
 * Increment view count using atomic database function
 * Prevents race conditions
 */
export async function incrementViewCount(circuitId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_circuit_views', {
      circuit_id: circuitId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error incrementing view count:', error);
  }
}

/**
 * Increment copy count using atomic database function
 * Prevents race conditions
 */
export async function incrementCopyCount(circuitId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_circuit_copies', {
      circuit_id: circuitId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error incrementing copy count:', error);
  }
}

/**
 * Track a copy event in the database
 */
export async function trackCopyEvent(circuitId: string, userId?: string): Promise<void> {
  try {
    const { error } = await supabase.from('circuit_copies').insert({
      circuit_id: circuitId,
      user_id: userId || null,
    });

    if (error) throw error;

    // Also increment the copy count
    await incrementCopyCount(circuitId);
  } catch (error) {
    console.error('Error tracking copy event:', error);
    throw error;
  }
}

/**
 * Check if a slug already exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('circuits')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - slug is available
        return false;
      }
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking slug:', error);
    return false;
  }
}

/**
 * Generate a unique slug from title
 * Handles collisions by appending numbers
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);

  let slug = baseSlug;
  let counter = 1;

  while (await slugExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Toggle favorite status for a circuit
 */
export async function toggleFavorite(circuitId: string, userId: string): Promise<boolean> {
  try {
    // Check if already favorited
    const { data: existingFavorite } = await supabase
      .from('favorites')
      .select('id')
      .eq('circuit_id', circuitId)
      .eq('user_id', userId)
      .single();

    if (existingFavorite) {
      // Unfavorite: remove the favorite
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('circuit_id', circuitId)
        .eq('user_id', userId);

      if (error) throw error;
      return false; // Now unfavorited
    } else {
      // Favorite: add the favorite
      const { error } = await supabase
        .from('favorites')
        .insert({
          circuit_id: circuitId,
          user_id: userId,
        });

      if (error) throw error;
      return true; // Now favorited
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
}

/**
 * Check if user has favorited a circuit
 */
export async function isFavorited(circuitId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('circuit_id', circuitId)
      .eq('user_id', userId)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's favorited circuits
 */
export async function getFavorites(
  userId: string,
  limit = 12,
  offset = 0
): Promise<CircuitsResponse> {
  try {
    const { data, error, count } = await supabase
      .from('favorites')
      .select(
        `
        circuit:circuits(
          *,
          user:profiles(id, username, avatar_url)
        )
        `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Extract circuits from the nested structure
    // Supabase returns arrays for nested relations
    const circuits = (data || [])
      .map((fav: { circuit: Circuit | Circuit[] }) =>
        Array.isArray(fav.circuit) ? fav.circuit[0] : fav.circuit
      )
      .filter(Boolean);

    return {
      circuits: circuits as Circuit[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error fetching favorites:', error);
    throw error;
  }
}
