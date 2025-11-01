import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering since we use Supabase client (accesses cookies)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get stats from global_stats table (single row, super fast)
    const { data: globalStats, error: statsError } = await supabase
      .from('global_stats')
      .select('total_circuits, total_copies, total_users, last_synced_at')
      .eq('id', 1)
      .single();

    if (statsError) {
      console.error('Error fetching global stats:', statsError);

      // Fallback to old method if global_stats doesn't exist yet
      console.log('Falling back to aggregation method...');

      const { count: circuitCount } = await supabase
        .from('circuits')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

      const { count: makerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        circuits: circuitCount || 0,
        copies: 0, // Can't efficiently calculate without migration
        makers: makerCount || 0,
      });
    }

    return NextResponse.json({
      circuits: globalStats.total_circuits || 0,
      copies: globalStats.total_copies || 0,
      makers: globalStats.total_users || 0,
      lastSynced: globalStats.last_synced_at,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
