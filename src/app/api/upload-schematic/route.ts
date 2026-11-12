import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAndUploadSchematic } from "@/lib/r2-schematic";
import { requireCircuitOwnerOrAdmin } from "@/lib/api-auth";
import type { SheetSize } from "@/lib/kicad-parser";

const VALID_SHEET_SIZES = new Set(["A4", "A3", "A2"]);

/**
 * (Re)generate a circuit's processed schematic in R2.
 *
 * The schematic is always built from the circuit's stored raw_sexpr, title and
 * sheet_size in the database — never from the request body — so the R2 file
 * can't diverge from what the owner saved.
 */
export async function POST(request: NextRequest) {
  try {
    const { circuitId } = await request.json();

    const access = await requireCircuitOwnerOrAdmin(circuitId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const supabase = createAdminClient();
    const { data: circuit, error: fetchError } = await supabase
      .from("circuits")
      .select("raw_sexpr, title, sheet_size")
      .eq("id", circuitId)
      .single();

    if (fetchError || !circuit?.raw_sexpr) {
      return NextResponse.json(
        { error: "Circuit has no schematic data" },
        { status: 404 },
      );
    }

    const sheetSize =
      circuit.sheet_size && VALID_SHEET_SIZES.has(circuit.sheet_size)
        ? (circuit.sheet_size as SheetSize)
        : null;

    // Process and upload schematic to R2
    const r2Url = await processAndUploadSchematic({
      circuitId,
      rawSexpr: circuit.raw_sexpr,
      title: circuit.title,
      sheetSizeOverride: sheetSize,
    });

    // Update database with R2 URL
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
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
