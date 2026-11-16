import { NextResponse } from "next/server";
import { createPublicClient, publicCacheHeaders } from "@/lib/supabase/public";
import { withEdgeCache } from "@/lib/edge-cache";

export const dynamic = "force-dynamic";

const CACHE = publicCacheHeaders(300);

async function handleGet() {
  try {
    const supabase = createPublicClient();

    // Get stats from global_stats table (single row, super fast)
    const { data: globalStats, error: statsError } = await supabase
      .from("global_stats")
      .select("total_circuits, total_copies, total_users, last_synced_at")
      .eq("id", 1)
      .single();

    if (statsError) {
      console.error("Error fetching global stats:", statsError);

      // Fallback to old method if global_stats doesn't exist yet
      console.log("Falling back to aggregation method...");

      const { count: circuitCount } = await supabase
        .from("circuits")
        .select("*", { count: "exact", head: true })
        .eq("is_public", true);

      const { count: makerCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      return NextResponse.json({
        circuits: circuitCount || 0,
        copies: 0, // Can't efficiently calculate without migration
        makers: makerCount || 0,
      }, { headers: CACHE });
    }

    return NextResponse.json({
      circuits: globalStats.total_circuits || 0,
      copies: globalStats.total_copies || 0,
      makers: globalStats.total_users || 0,
      lastSynced: globalStats.last_synced_at,
    }, { headers: CACHE });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}

// Served from Cloudflare's edge cache for as long as Cache-Control allows.
export const GET = withEdgeCache(handleGet);
