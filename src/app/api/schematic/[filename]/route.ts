import { NextRequest, NextResponse } from 'next/server';
import { isClipboardSnippet, wrapSnippetToFullFile } from '@/lib/kicad-parser';
import { getCircuitBySlug } from '@/lib/circuits';

/**
 * API endpoint to serve schematic files for KiCanvas viewer
 * Fetches circuit from database and serves the raw S-expression as a .kicad_sch file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Extract slug from filename (e.g., "8k2-r.kicad_sch" -> "8k2-r")
    const slug = params.filename.replace('.kicad_sch', '');

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
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `inline; filename="${params.filename}"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Get raw S-expression from database
    const rawData = circuit.raw_sexpr;

    if (!rawData) {
      return NextResponse.json(
        { error: 'Circuit data not found' },
        { status: 404 }
      );
    }

    // Check if raw data is a snippet or full file, and prepare accordingly
    let schematicFile: string;
    if (isClipboardSnippet(rawData)) {
      // It's a snippet - wrap it for serving as .kicad_sch file
      schematicFile = wrapSnippetToFullFile(rawData, {
        title: circuit.title,
        uuid: circuit.id, // Use circuit UUID
      });
    } else {
      // It's already a full file - use as-is
      schematicFile = rawData;
    }

    // Return with proper content type
    return new NextResponse(schematicFile, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${params.filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Failed to serve schematic:', error);
    return NextResponse.json(
      { error: 'Failed to serve schematic file' },
      { status: 500 }
    );
  }
}
