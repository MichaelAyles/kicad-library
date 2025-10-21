import { NextRequest, NextResponse } from 'next/server';
import { isClipboardSnippet, wrapSnippetToFullFile } from '@/lib/kicad-parser';
import { createClient } from '@/lib/supabase/server';

/**
 * POST: Store a preview schematic and return its ID
 * Uses Supabase storage for serverless compatibility
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

    // Store in Supabase storage (temporary bucket)
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from('previews')
      .upload(`${previewId}.kicad_sch`, fullFile, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload preview:', uploadError);
      throw new Error('Failed to store preview');
    }

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

    // Retrieve from Supabase storage
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from('previews')
      .download(`${previewId}.kicad_sch`);

    if (error || !data) {
      console.error('Failed to retrieve preview:', error);
      return NextResponse.json(
        { error: 'Preview not found or expired' },
        { status: 404 }
      );
    }

    // Convert Blob to text
    const text = await data.text();

    // Return the schematic as a .kicad_sch file
    // IMPORTANT: Use text/plain (not application/x-kicad-schematic) - this is what KiCanvas expects
    return new NextResponse(text, {
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
