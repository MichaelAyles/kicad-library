import { NextRequest, NextResponse } from "next/server";
import { previewCache } from "@/lib/preview-cache";

/**
 * GET: Retrieve a preview schematic by ID from a filename-based URL
 * This route exists so KiCanvas can see the .kicad_sch extension in the URL path
 * Example: /api/preview/preview.kicad_sch?id=preview-123
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const previewId = searchParams.get("id");

    if (!previewId) {
      return NextResponse.json(
        { error: "Missing preview ID" },
        { status: 400 },
      );
    }

    // Retrieve from LRU cache
    const cached = previewCache.get(previewId);

    if (!cached) {
      console.error("Preview not found in cache:", previewId);
      return NextResponse.json(
        { error: "Preview not found or expired" },
        { status: 404 },
      );
    }

    // Return the schematic as a .kicad_sch file
    // IMPORTANT: Use text/plain (not application/x-kicad-schematic) - this is what KiCanvas expects
    return new NextResponse(cached.sexpr, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${params.filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Preview GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve preview" },
      { status: 500 },
    );
  }
}
