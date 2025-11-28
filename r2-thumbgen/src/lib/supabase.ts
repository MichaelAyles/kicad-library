import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CircuitWithUser {
  id: string;
  slug: string;
  title: string;
  user_id: string;
  created_at: string;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
  profile: {
    username: string;
    avatar_url: string | null;
  };
}

export interface CircuitDetail extends CircuitWithUser {
  raw_sexpr: string;
}

/**
 * Fetch all circuits with user information
 * Uses pagination to fetch all records (no 1000 limit)
 */
export async function fetchAllCircuits(): Promise<CircuitWithUser[]> {
  const pageSize = 1000;
  let allCircuits: CircuitWithUser[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('circuits')
      .select(`
        id,
        slug,
        title,
        user_id,
        created_at,
        thumbnail_light_url,
        thumbnail_dark_url,
        profile:profiles!user_id (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch circuits: ${error.message}`);
    }

    if (data && data.length > 0) {
      // Transform profile from array to object (Supabase returns array for relations)
      const transformed = data.map(circuit => ({
        ...circuit,
        profile: Array.isArray(circuit.profile) ? circuit.profile[0] : circuit.profile
      })) as CircuitWithUser[];
      allCircuits = [...allCircuits, ...transformed];
      page++;
      hasMore = data.length === pageSize; // Continue if we got a full page
    } else {
      hasMore = false;
    }
  }

  return allCircuits;
}

/**
 * Check if a file exists in Supabase storage
 */
export async function checkSupabaseFile(bucket: string, path: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path.split('/').slice(0, -1).join('/'), {
      search: path.split('/').pop()
    });

  if (error) {
    return false;
  }

  return data.length > 0;
}

/**
 * Fetch a single circuit with raw S-expression
 */
export async function fetchCircuitById(id: string): Promise<CircuitDetail | null> {
  const { data, error } = await supabase
    .from('circuits')
    .select(`
      id,
      slug,
      title,
      user_id,
      created_at,
      thumbnail_light_url,
      thumbnail_dark_url,
      raw_sexpr,
      profile:profiles!user_id (
        username,
        avatar_url
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch circuit:', error);
    return null;
  }

  // Transform profile from array to object
  const transformed = {
    ...data,
    profile: Array.isArray(data.profile) ? data.profile[0] : data.profile
  } as CircuitDetail;

  return transformed;
}

/**
 * Get statistics about circuits and thumbnails
 */
export async function getCircuitStats() {
  const circuits = await fetchAllCircuits();

  const stats = {
    totalCircuits: circuits.length,
    withLightThumbnail: circuits.filter(c => c.thumbnail_light_url).length,
    withDarkThumbnail: circuits.filter(c => c.thumbnail_dark_url).length,
    withBothThumbnails: circuits.filter(c => c.thumbnail_light_url && c.thumbnail_dark_url).length,
    withNoThumbnails: circuits.filter(c => !c.thumbnail_light_url && !c.thumbnail_dark_url).length,
    uniqueUsers: new Set(circuits.map(c => c.user_id)).size,
  };

  return { circuits, stats };
}
