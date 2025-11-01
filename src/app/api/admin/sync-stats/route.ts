import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync-stats
 * Recalculate global stats from source data
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminStatus = await isAdmin(user);
    if (!adminStatus) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Call the sync function
    const { error: syncError } = await supabase.rpc('sync_global_stats');

    if (syncError) {
      console.error('Error syncing global stats:', syncError);
      throw syncError;
    }

    // Fetch updated stats
    const { data: updatedStats, error: fetchError } = await supabase
      .from('global_stats')
      .select('*')
      .eq('id', 1)
      .single();

    if (fetchError) {
      console.error('Error fetching updated stats:', fetchError);
      throw fetchError;
    }

    return NextResponse.json({
      success: true,
      message: 'Global stats synchronized successfully',
      stats: updatedStats,
    });
  } catch (error: any) {
    console.error('Error in sync-stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync stats' },
      { status: 500 }
    );
  }
}
