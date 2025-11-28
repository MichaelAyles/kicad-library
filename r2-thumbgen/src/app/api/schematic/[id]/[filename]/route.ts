import { NextRequest, NextResponse } from 'next/server';
import { fetchCircuitById } from '@/lib/supabase';
import { isClipboardSnippet, wrapSnippetToFullFile, removeHierarchicalSheets } from '@/lib/kicad-parser';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  try {
    const circuitId = params.id;

    // Fetch circuit from Supabase
    const circuit = await fetchCircuitById(circuitId);

    if (!circuit) {
      return new NextResponse('Circuit not found', { status: 404 });
    }

    // Check if the S-expression is a snippet and wrap it if needed
    let schematicContent = circuit.raw_sexpr;
    const firstChars = schematicContent.trim().substring(0, 50);

    console.log(`[API] Circuit: ${circuit.slug}`);
    console.log(`[API] First 50 chars: ${firstChars}`);

    if (isClipboardSnippet(schematicContent)) {
      console.log(`[API] ✓ Detected snippet - wrapping for circuit: ${circuit.slug}`);
      schematicContent = wrapSnippetToFullFile(schematicContent, {
        title: circuit.title,
        uuid: circuit.id,
      });
      console.log(`[API] ✓ Wrapped - now starts with: ${schematicContent.trim().substring(0, 20)}`);
    } else {
      console.log(`[API] Already a full file - no wrapping needed`);
    }

    // Remove hierarchical sheet references to prevent KiCanvas from trying to load non-existent files
    schematicContent = removeHierarchicalSheets(schematicContent);

    // Return the S-expression as a .kicad_sch file
    // KiCanvas expects the Content-Type to be text/plain for .kicad_sch files
    return new NextResponse(schematicContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${params.filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error serving schematic:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
