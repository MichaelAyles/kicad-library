import { NextResponse } from "next/server";
import { createPublicClient, publicCacheHeaders } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

// Matches PostgREST's max-rows cap on a single response
const PAGE_SIZE = 1000;

export async function GET() {
  try {
    const supabase = createPublicClient();

    // Page through every public circuit's tags. A single unpaginated select
    // is capped at 1000 rows, so it would only count an arbitrary subset.
    // The response is edge-cached, so the extra round trips are cheap.
    const circuits: { tags: string[] | null }[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("circuits")
        .select("tags")
        .eq("is_public", true)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching circuits:", error);
        throw error;
      }

      circuits.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    // Count tag frequencies
    const tagCounts = new Map<string, number>();

    circuits.forEach((circuit) => {
      if (circuit.tags && Array.isArray(circuit.tags)) {
        circuit.tags.forEach((tag: string) => {
          const normalizedTag = tag.toLowerCase().trim();
          if (normalizedTag) {
            tagCounts.set(
              normalizedTag,
              (tagCounts.get(normalizedTag) || 0) + 1,
            );
          }
        });
      }
    });

    // Convert to array and sort by frequency
    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Return top 20 tags

    return NextResponse.json(
      { tags: popularTags },
      { headers: publicCacheHeaders(3600) },
    );
  } catch (error) {
    console.error("Error in tags API:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular tags" },
      { status: 500 },
    );
  }
}
