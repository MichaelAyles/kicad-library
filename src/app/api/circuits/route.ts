import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSExpression, extractMetadata } from '@/lib/kicad-parser';
import { generateUniqueSlug } from '@/lib/circuits';

/**
 * POST /api/circuits - Create a new circuit
 * Server-side endpoint with validation and authentication
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      description,
      raw_sexpr,
      category,
      tags,
      license,
      is_public,
      thumbnail_light_url,
      thumbnail_dark_url,
    } = body;

    // Validate required fields
    if (!title || !description || !raw_sexpr || !license) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, raw_sexpr, license' },
        { status: 400 }
      );
    }

    // Validate S-expression
    const validation = validateSExpression(raw_sexpr);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid S-expression',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(title);

    // Extract metadata from S-expression
    let metadata = null;
    let component_count = 0;
    let wire_count = 0;
    let net_count = 0;

    try {
      metadata = extractMetadata(raw_sexpr);
      component_count = metadata.stats.componentCount;
      wire_count = metadata.stats.wireCount;
      net_count = metadata.stats.netCount;
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      // Continue anyway - metadata extraction is not critical
    }

    // Insert circuit into database
    const { data: circuit, error: insertError } = await supabase
      .from('circuits')
      .insert({
        user_id: user.id,
        slug,
        title,
        description,
        raw_sexpr,
        category: category || null,
        tags: tags || [],
        license,
        is_public: is_public !== undefined ? is_public : true,
        component_count,
        wire_count,
        net_count,
        thumbnail_light_url: thumbnail_light_url || null,
        thumbnail_dark_url: thumbnail_dark_url || null,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create circuit', details: insertError.message },
        { status: 500 }
      );
    }

    // Return created circuit
    return NextResponse.json(
      {
        success: true,
        circuit,
        metadata,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Circuit creation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circuits - Get list of circuits
 * Optional query params: limit, offset, sortBy
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = (searchParams.get('sortBy') || 'copies') as 'copies' | 'recent' | 'favorites';

    let query = supabase
      .from('circuits')
      .select(
        `*,
        user:profiles(id, username, avatar_url)`,
        { count: 'exact' }
      )
      .eq('is_public', true)
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply sorting
    if (sortBy === 'copies') {
      query = query.order('copy_count', { ascending: false });
    } else if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'favorites') {
      query = query.order('favorite_count', { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({ error: 'Failed to fetch circuits' }, { status: 500 });
    }

    return NextResponse.json({
      circuits: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Circuits fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
