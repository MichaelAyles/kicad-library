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

export async function incrementViewCount(circuitId: string): Promise<void> {
  try {
    // Get current count
    const { data, error: fetchError } = await supabase
      .from('circuits')
      .select('view_count')
      .eq('id', circuitId)
      .single();

    if (fetchError) throw fetchError;

    // Update with incremented value
    const { error: updateError } = await supabase
      .from('circuits')
      .update({ view_count: (data?.view_count || 0) + 1 })
      .eq('id', circuitId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error incrementing view count:', error);
  }
}

export async function incrementCopyCount(circuitId: string): Promise<void> {
  try {
    // Get current count
    const { data, error: fetchError } = await supabase
      .from('circuits')
      .select('copy_count')
      .eq('id', circuitId)
      .single();

    if (fetchError) throw fetchError;

    // Update with incremented value
    const { error: updateError } = await supabase
      .from('circuits')
      .update({ copy_count: (data?.copy_count || 0) + 1 })
      .eq('id', circuitId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error incrementing copy count:', error);
  }
}
