import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { deleteUserAccount } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/delete-user
 * Delete a user and all their data (admin only)
 * Cascade deletes: circuits, comments, favorites, flags, etc.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const supabase = createAdminClient();

    // Get user ID from request
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own admin account" },
        { status: 400 },
      );
    }

    // Get user details before deletion for logging
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, id")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete from auth.users with the service role; this cascades to the
    // profile and all related data, then R2 files are cleaned up.
    const { circuitCount } = await deleteUserAccount(userId);

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
    console.error("Error in delete-user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/delete-user/search
 * Search for users (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = createAdminClient();

    const { searchQuery, limit = 50 } = await request.json();
    const pageLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(pageLimit);

    // If search query provided, filter by username
    if (typeof searchQuery === "string" && searchQuery.trim()) {
      query = query.ilike("username", `%${searchQuery.trim()}%`);
    }

    const { data: profiles, error } = await query;

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Batch the per-user stats into one paged query per table (instead of
    // four queries per user). The admin client sees private circuits too.
    const userIds = profiles.map((profile) => profile.id);
    const [circuits, comments, favorites] = await Promise.all([
      fetchRowsForUsers<{ user_id: string; copy_count: number | null }>(
        supabase,
        "circuits",
        "user_id, copy_count",
        userIds,
      ),
      fetchRowsForUsers<{ user_id: string }>(
        supabase,
        "circuit_comments",
        "user_id",
        userIds,
      ),
      fetchRowsForUsers<{ user_id: string }>(
        supabase,
        "favorites",
        "user_id",
        userIds,
      ),
    ]);

    const stats = new Map(
      userIds.map((id) => [
        id,
        { circuitCount: 0, totalCopies: 0, commentCount: 0, favoriteCount: 0 },
      ]),
    );
    for (const circuit of circuits) {
      const userStats = stats.get(circuit.user_id);
      if (!userStats) continue;
      userStats.circuitCount++;
      userStats.totalCopies += circuit.copy_count || 0;
    }
    for (const comment of comments) {
      const userStats = stats.get(comment.user_id);
      if (userStats) userStats.commentCount++;
    }
    // Favorites the user has given
    for (const favorite of favorites) {
      const userStats = stats.get(favorite.user_id);
      if (userStats) userStats.favoriteCount++;
    }

    const usersWithStats = profiles.map((profile) => ({
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      ...stats.get(profile.id)!,
    }));

    return NextResponse.json({ users: usersWithStats });
  } catch (error: any) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search users" },
      { status: 500 },
    );
  }
}

// PostgREST caps a single response at 1000 rows
const PAGE_SIZE = 1000;

/**
 * Fetch `columns` from every row of `table` owned by any of `userIds`,
 * paging past the response row cap (one user can own thousands of circuits).
 */
async function fetchRowsForUsers<T>(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string,
  userIds: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("user_id", userIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
