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
  thumbnail_light: string | null;
  thumbnail_dark: string | null;
  profile: {
    username: string;
    avatar_url: string | null;
  };
}

/**
 * Fetch all circuits with user information
 */
export async function fetchAllCircuits(): Promise<CircuitWithUser[]> {
  const { data, error } = await supabase
    .from('circuits')
    .select(`
      id,
      slug,
      title,
      user_id,
      created_at,
      thumbnail_light,
      thumbnail_dark,
      profile:profiles!user_id (
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch circuits: ${error.message}`);
  }

  return data as CircuitWithUser[];
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
 * Get statistics about circuits and thumbnails
 */
export async function getCircuitStats() {
  const circuits = await fetchAllCircuits();

  const stats = {
    totalCircuits: circuits.length,
    withLightThumbnail: circuits.filter(c => c.thumbnail_light).length,
    withDarkThumbnail: circuits.filter(c => c.thumbnail_dark).length,
    withBothThumbnails: circuits.filter(c => c.thumbnail_light && c.thumbnail_dark).length,
    withNoThumbnails: circuits.filter(c => !c.thumbnail_light && !c.thumbnail_dark).length,
    uniqueUsers: new Set(circuits.map(c => c.user_id)).size,
  };

  return { circuits, stats };
}
