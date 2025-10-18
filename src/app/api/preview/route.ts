import { NextRequest, NextResponse } from 'next/server';
import { isClipboardSnippet, wrapSnippetToFullFile } from '@/lib/kicad-parser';

/**
 * In-memory cache for preview schematics
 * Maps preview ID to schematic content
 * This is temporary storage for upload previews
 */
const previewCache = new Map<string, { sexpr: string; timestamp: number }>();

// Clean up old previews (older than 1 hour)
function cleanupOldPreviews() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, data] of previewCache.entries()) {
    if (data.timestamp < oneHourAgo) {
      previewCache.delete(id);
    }
  }
}

/**
 * POST: Store a preview schematic and return its ID
 */
export async function POST(request: NextRequest) {
  try {
    const { sexpr } = await request.json();

    if (!sexpr || typeof sexpr !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid sexpr data' },
        { status: 400 }
      );
    }

    // Ensure we have a full KiCad file (not just a snippet)
    // KiCanvas requires a complete .kicad_sch file structure
    let fullFile = sexpr;
    if (isClipboardSnippet(sexpr)) {
      console.log('Preview API: Wrapping clipboard snippet into full file');
      fullFile = wrapSnippetToFullFile(sexpr, {
        title: 'Circuit Preview',
        uuid: `preview-${Date.now()}`
      });
    } else {
      console.log('Preview API: Already a full file, using as-is');
    }

    // Generate unique preview ID
    const previewId = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store in cache (store the full file format)
    previewCache.set(previewId, {
      sexpr: fullFile,
      timestamp: Date.now(),
    });

    // Cleanup old previews
    cleanupOldPreviews();

    return NextResponse.json({ previewId });
  } catch (error) {
    console.error('Preview POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create preview' },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve a preview schematic by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const previewId = searchParams.get('id');

    if (!previewId) {
      return NextResponse.json(
        { error: 'Missing preview ID' },
        { status: 400 }
      );
    }

    const cached = previewCache.get(previewId);

    if (!cached) {
      return NextResponse.json(
        { error: 'Preview not found or expired' },
        { status: 404 }
      );
    }

    // Return the schematic as a .kicad_sch file
    // IMPORTANT: Use text/plain (not application/x-kicad-schematic) - this is what KiCanvas expects
    return new NextResponse(cached.sexpr, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="preview.kicad_sch"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Preview GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve preview' },
      { status: 500 }
    );
  }
}
