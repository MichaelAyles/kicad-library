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
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
  is_public: boolean;
  is_featured: boolean;
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
  sortBy: 'copies' | 'recent' | 'favorites' = 'copies',
  excludeImported = false
): Promise<CircuitsResponse> {
  try {
    // If excluding imported circuits, first get the importer user's ID
    let importerUserId: string | null = null;
    if (excludeImported) {
      const { data: importerUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'circuitsnips-importer')
        .single();

      importerUserId = importerUser?.id || null;
    }

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

    // Exclude circuits from @circuitsnips-importer if requested
    if (excludeImported && importerUserId) {
      query = query.neq('user_id', importerUserId);
    }

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
    // Don't filter by is_public - let RLS policy handle access control
    // RLS allows: public circuits for everyone, private circuits for owner
    const { data, error } = await supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`
      )
      .eq('slug', slug)
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

export async function searchCircuits(
  query: string,
  limit = 12,
  offset = 0
): Promise<CircuitsResponse> {
  try {
    const { data, error, count } = await supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`,
        { count: 'exact' }
      )
      .eq('is_public', true)
      .or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      )
      .order('copy_count', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      circuits: (data || []) as Circuit[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error searching circuits:', error);
    throw error;
  }
}

/**
 * Atomically increment view count to prevent race conditions
 * Uses database RPC function for atomic increment
 */
export async function incrementViewCount(circuitId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_circuit_views', {
      circuit_id: circuitId
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    // Silently fail - don't block user experience for analytics
  }
}

/**
 * Atomically increment copy count to prevent race conditions
 * Uses database RPC function for atomic increment
 */
export async function incrementCopyCount(circuitId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_circuit_copies', {
      circuit_id: circuitId
    });

    if (error) {
      console.error('Error incrementing copy count:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error incrementing copy count:', error);
    throw error;
  }
}

/**
 * Check if the current user has favorited a circuit
 */
export async function checkIfFavorited(circuitId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('circuit_id', circuitId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}

/**
 * Add a circuit to user's favorites
 * Triggers automatic favorite_count increment via database trigger
 */
export async function addFavorite(circuitId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('favorites')
      .insert({ circuit_id: circuitId, user_id: userId });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding favorite:', error);
    throw error;
  }
}

/**
 * Remove a circuit from user's favorites
 * Triggers automatic favorite_count decrement via database trigger
 */
export async function removeFavorite(circuitId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('circuit_id', circuitId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
}

/**
 * Toggle favorite status for a circuit
 * Returns the new favorited state
 */
export async function toggleFavorite(circuitId: string, userId: string): Promise<boolean> {
  try {
    const isFavorited = await checkIfFavorited(circuitId, userId);

    if (isFavorited) {
      await removeFavorite(circuitId, userId);
      return false;
    } else {
      await addFavorite(circuitId, userId);
      return true;
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
}
