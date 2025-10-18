import { NextRequest, NextResponse } from 'next/server';
import { knockSensorCircuit } from '@/lib/knock-sensor-data';
import { isClipboardSnippet, wrapSnippetToFullFile } from '@/lib/kicad-parser';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Extract slug from filename (e.g., "tpic8101-knock-sensor-interface.kicad_sch" -> "tpic8101-knock-sensor-interface")
    const slug = params.filename.replace('.kicad_sch', '');

    // For MVP, only support knock sensor circuit
    if (slug !== knockSensorCircuit.slug) {
      return NextResponse.json(
        { error: 'Circuit not found' },
        { status: 404 }
      );
    }

    // Load raw data from filesystem (server-side)
    // TODO: In production, load from database: raw_sexpr field
    const filePath = join(process.cwd(), 'public', 'example-Knock-Sensor.txt');
    const rawData = await readFile(filePath, 'utf-8');

    // Check if raw data is a snippet or full file, and prepare accordingly
    let schematicFile: string;
    if (isClipboardSnippet(rawData)) {
      // It's a snippet - wrap it for serving as .kicad_sch file
      schematicFile = wrapSnippetToFullFile(rawData, {
        title: knockSensorCircuit.title,
        uuid: knockSensorCircuit.uuid,
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
    console.error('Failed to generate schematic:', error);
    return NextResponse.json(
      { error: 'Failed to generate schematic file' },
      { status: 500 }
    );
  }
}
