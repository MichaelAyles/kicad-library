import { NextRequest, NextResponse } from "next/server";
import { getCircuitBySlug } from "@/lib/circuits";
import { processAndUploadSchematic } from "@/lib/r2-schematic";
import type { SheetSize } from "@/lib/kicad-parser";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * API endpoint to serve schematic files for KiCanvas viewer.
 *
 * Lazy write-through cache: if the circuit already has a processed schematic
 * in R2, redirect there (zero compute). Otherwise, process once, upload to R2,
 * update the DB, and serve the result inline.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } },
) {
  try {
    // Extract slug from filename (e.g., "8k2-r.kicad_sch" -> "8k2-r")
    const slug = params.filename.replace(".kicad_sch", "");

    // Fetch circuit from database
    const circuit = await getCircuitBySlug(slug);

    if (!circuit) {
      // Return an empty schematic stub instead of 404 JSON error
      // This handles hierarchical sheet references that don't exist in our database
      // KiCanvas will load an empty sheet instead of crashing
      const emptySchematic = `(kicad_sch (version 20230121) (generator "CircuitSnips")
  (uuid 00000000-0000-0000-0000-000000000000)
  (paper "A4")
  (title_block
    (title "Sheet Not Found")
    (comment 1 "This hierarchical sheet is not available")
  )
)`;
      return new NextResponse(emptySchematic, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${params.filename}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Fast path: if R2 URL exists, redirect to CDN-cached schematic
    if (circuit.schematic_r2_url) {
      return NextResponse.redirect(circuit.schematic_r2_url, 302);
    }

    // Slow path: no R2 URL — process, upload, and serve
    const rawData = circuit.raw_sexpr;

    if (!rawData) {
      return NextResponse.json(
        { error: "Circuit data not found" },
        { status: 404 },
      );
    }

    // Validate the circuit data is a valid KiCad S-expression
    const trimmedData = rawData.trim();

    // Check if it starts with HTML/XML (corrupted data)
    if (
      trimmedData.startsWith("<!DOCTYPE") ||
      trimmedData.startsWith("<html") ||
      trimmedData.startsWith("<?xml")
    ) {
      console.error(
        `Circuit ${slug} contains corrupted data (HTML/XML instead of schematic)`,
      );
      const emptySchematic = `(kicad_sch (version 20230121) (generator "CircuitSnips")
  (uuid 00000000-0000-0000-0000-000000000000)
  (paper "A4")
  (title_block
    (title "Corrupted Data")
    (comment 1 "This circuit contains invalid data and cannot be displayed")
  )
)`;
      return new NextResponse(emptySchematic, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${params.filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Check if it starts with a valid S-expression
    if (!trimmedData.startsWith("(kicad_sch") && !trimmedData.startsWith("(")) {
      console.error(`Circuit ${slug} data is not a valid KiCad S-expression`);
      const emptySchematic = `(kicad_sch (version 20230121) (generator "CircuitSnips")
  (uuid 00000000-0000-0000-0000-000000000000)
  (paper "A4")
  (title_block
    (title "Invalid Data")
    (comment 1 "This circuit contains invalid data and cannot be displayed")
  )
)`;
      return new NextResponse(emptySchematic, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${params.filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Process and upload to R2
    const r2Url = await processAndUploadSchematic({
      circuitId: circuit.id,
      rawSexpr: rawData,
      title: circuit.title,
      sheetSizeOverride: (circuit.sheet_size as SheetSize) || null,
    });

    // Update DB with R2 URL for future requests
    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", circuit.id);

    if (dbError) {
      console.error(`Failed to update schematic_r2_url for ${slug}:`, dbError);
      // Non-fatal — we still have the processed content via R2
    }

    // Redirect to the newly uploaded R2 URL
    return NextResponse.redirect(r2Url, 302);
  } catch (error) {
    console.error("Failed to serve schematic:", error);
    return NextResponse.json(
      { error: "Failed to serve schematic file" },
      { status: 500 },
    );
  }
}
