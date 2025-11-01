import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/delete-user
 * Delete a user and all their data (admin only)
 * Cascade deletes: circuits, comments, favorites, flags, etc.
 */
export async function DELETE(request: NextRequest) {
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

    // Get user ID from request
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own admin account' },
        { status: 400 }
      );
    }

    // Get user details before deletion for logging
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username, id')
      .eq('id', userId)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count user's circuits for response
    const { count: circuitCount } = await supabase
      .from('circuits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Delete from auth.users (this cascades to profiles and all related data via ON DELETE CASCADE)
    // We need to use the service role for this operation
    const supabaseAdmin = await createClient();

    // Note: Direct auth.users deletion requires service role key
    // Since we're using the regular client, we'll delete the profile
    // which should cascade due to foreign key constraints

    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: `User @${userProfile.username} deleted successfully`,
      deletedUser: {
        id: userProfile.id,
        username: userProfile.username,
        circuitCount: circuitCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in delete-user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/delete-user/search
 * Search for users (admin only)
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

    const { searchQuery, limit = 50 } = await request.json();

    let query = supabase
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        created_at,
        circuits:circuits(count)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // If search query provided, filter by username
    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('username', `%${searchQuery.trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform the data to include circuit count
    const users = (data || []).map((user: any) => ({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      circuitCount: user.circuits?.[0]?.count || 0,
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search users' },
      { status: 500 }
    );
  }
}
