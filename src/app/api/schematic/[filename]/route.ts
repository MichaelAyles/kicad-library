import { NextRequest, NextResponse } from 'next/server';
import { isClipboardSnippet, wrapSnippetToFullFile, removeHierarchicalSheets } from '@/lib/kicad-parser';
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

    // Validate the circuit data is a valid KiCad S-expression
    const trimmedData = rawData.trim();

    // Check if it starts with HTML/XML (corrupted data)
    if (trimmedData.startsWith('<!DOCTYPE') || trimmedData.startsWith('<html') || trimmedData.startsWith('<?xml')) {
      console.error(`Circuit ${slug} contains corrupted data (HTML/XML instead of schematic)`);
      // Return empty schematic stub for corrupted data
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
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `inline; filename="${params.filename}"`,
          'Cache-Control': 'no-cache', // Don't cache corrupted data
        },
      });
    }

    // Check if it starts with a valid S-expression
    if (!trimmedData.startsWith('(kicad_sch') && !trimmedData.startsWith('(')) {
      console.error(`Circuit ${slug} data is not a valid KiCad S-expression`);
      // Return empty schematic stub for invalid data
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
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `inline; filename="${params.filename}"`,
          'Cache-Control': 'no-cache',
        },
      });
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

    // Remove hierarchical sheet references to prevent KiCanvas from trying to load non-existent files
    schematicFile = removeHierarchicalSheets(schematicFile);

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
