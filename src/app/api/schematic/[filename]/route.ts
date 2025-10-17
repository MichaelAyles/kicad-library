import { NextRequest, NextResponse } from 'next/server';
import { knockSensorCircuit } from '@/lib/knock-sensor-data';
import { wrapWithKiCadHeaders } from '@/lib/parser';
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
    const filePath = join(process.cwd(), 'public', 'example-Knock-Sensor.txt');
    const rawData = await readFile(filePath, 'utf-8');

    // Wrap with KiCad headers
    const schematicFile = wrapWithKiCadHeaders(rawData, {
      title: knockSensorCircuit.title,
      uuid: knockSensorCircuit.uuid,
    });

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
