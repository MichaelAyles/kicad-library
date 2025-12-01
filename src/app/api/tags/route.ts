import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get all circuits with their tags
    const { data: circuits, error } = await supabase
      .from("circuits")
      .select("tags")
      .eq("is_public", true);

    if (error) {
      console.error("Error fetching circuits:", error);
      throw error;
    }

    // Count tag frequencies
    const tagCounts = new Map<string, number>();

    circuits?.forEach((circuit) => {
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

    return NextResponse.json({
      tags: popularTags,
    });
  } catch (error) {
    console.error("Error in tags API:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular tags" },
      { status: 500 },
    );
  }
}
