import { createClient } from '@/lib/supabase/client';

/**
 * Shuffle circuits that have equal scores to randomize their order
 * This gives all circuits with the same metric a fair chance at visibility
 */
function shuffleEqualScores(circuits: Circuit[], sortBy: 'copies' | 'recent' | 'favorites'): Circuit[] {
  if (circuits.length === 0) return circuits;

  const getScoreKey = (sortBy: string): keyof Circuit => {
    switch (sortBy) {
      case 'copies': return 'copy_count';
      case 'favorites': return 'favorite_count';
      case 'recent': return 'created_at';
      default: return 'copy_count';
    }
  };

  const scoreKey = getScoreKey(sortBy);
  const result: Circuit[] = [];
  let currentGroup: Circuit[] = [];
  let currentScore: any = null;

  // Group circuits by their score
  circuits.forEach((circuit, index) => {
    const score = circuit[scoreKey];

    if (currentScore === null || score === currentScore) {
      // Same score, add to current group
      currentGroup.push(circuit);
      currentScore = score;
    } else {
      // Different score, shuffle and flush current group
      if (currentGroup.length > 1) {
        // Fisher-Yates shuffle for groups with ties
        for (let i = currentGroup.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentGroup[i], currentGroup[j]] = [currentGroup[j], currentGroup[i]];
        }
      }
      result.push(...currentGroup);

      // Start new group
      currentGroup = [circuit];
      currentScore = score;
    }

    // Handle last group
    if (index === circuits.length - 1) {
      if (currentGroup.length > 1) {
        for (let i = currentGroup.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentGroup[i], currentGroup[j]] = [currentGroup[j], currentGroup[i]];
        }
      }
      result.push(...currentGroup);
    }
  });

  return result;
}

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

    // Randomize order for circuits with equal scores (ties)
    const circuits = (data || []) as Circuit[];
    const shuffledCircuits = shuffleEqualScores(circuits, sortBy);

    return {
      circuits: shuffledCircuits,
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

/**
 * @deprecated Use searchCircuits from '@/lib/search' instead for weighted search
 * This function now uses the centralized search API with weighted ranking
 */
export async function searchCircuits(
  query: string,
  limit = 12,
  offset = 0
): Promise<CircuitsResponse> {
  try {
    // Import dynamically to avoid circular dependency
    const { searchCircuits: centralizedSearch } = await import('@/lib/search');

    const { circuits: results } = await centralizedSearch({
      query,
      limit,
      sort: 'relevance',
    });

    return {
      circuits: results as unknown as Circuit[],
      total: results.length,
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
