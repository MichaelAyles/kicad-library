import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sync-stats
 * Recalculate global stats from source data
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createAdminClient();

    // Call the sync function
    // sync_global_stats is only executable by the service role
    const { error: syncError } = await supabase.rpc(
      "sync_global_stats",
    );

    if (syncError) {
      console.error("Error syncing global stats:", syncError);
      throw syncError;
    }

    // Fetch updated stats
    const { data: updatedStats, error: fetchError } = await supabase
      .from("global_stats")
      .select("*")
      .eq("id", 1)
      .single();

    if (fetchError) {
      console.error("Error fetching updated stats:", fetchError);
      throw fetchError;
    }

    return NextResponse.json({
      success: true,
      message: "Global stats synchronized successfully",
      stats: updatedStats,
    });
  } catch (error: any) {
    console.error("Error in sync-stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync stats" },
      { status: 500 },
    );
  }
}
