import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processAndUploadSchematic } from "@/lib/r2-schematic";
import type { SheetSize } from "@/lib/kicad-parser";

// Initialize Supabase client for database updates
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const { circuitId, rawSexpr, title, sheetSize } = await request.json();

    if (!circuitId) {
      return NextResponse.json({ error: "Missing circuitId" }, { status: 400 });
    }

    if (!rawSexpr) {
      return NextResponse.json(
        { error: "Missing schematic data" },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    // Process and upload schematic to R2
    const r2Url = await processAndUploadSchematic({
      circuitId,
      rawSexpr,
      title,
      sheetSizeOverride: sheetSize as SheetSize | null,
    });

    // Update database with R2 URL
    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", circuitId);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return NextResponse.json(
        {
          error: "Uploaded to R2 but failed to update database",
          url: r2Url,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      circuitId,
      url: r2Url,
    });
  } catch (error) {
    console.error("Schematic upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
