import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';
    const license = searchParams.get('license') || '';
    const sort = searchParams.get('sort') || 'relevance';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const excludeImported = searchParams.get('excludeImported') === 'true';

    // If excluding imported circuits, first get the importer user's ID
    let importerUserId: string | null = null;
    if (excludeImported) {
      const { data: importerUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'circuitsnips-importer')
        .single();

      importerUserId = importerUser?.id || null;
    }

    let supabaseQuery = supabase
      .from('circuits')
      .select(`
        id,
        slug,
        title,
        description,
        tags,
        category,
        license,
        thumbnail_light_url,
        thumbnail_dark_url,
        view_count,
        copy_count,
        favorite_count,
        created_at,
        profiles!circuits_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .eq('is_public', true);

    // Full-text search using weighted search_vector (tags > title > description)
    if (query) {
      // Use textSearch for full-text search on the search_vector column
      supabaseQuery = supabaseQuery.textSearch('search_vector', query.trim());
    }

    // Category filter
    if (category) {
      supabaseQuery = supabaseQuery.eq('category', category);
    }

    // Tag filter (array contains)
    if (tag) {
      supabaseQuery = supabaseQuery.contains('tags', [tag]);
    }

    // License filter
    if (license) {
      supabaseQuery = supabaseQuery.eq('license', license);
    }

    // Exclude bulk-imported circuits if requested
    if (excludeImported && importerUserId) {
      supabaseQuery = supabaseQuery.neq('user_id', importerUserId);
    }

    // Sorting
    switch (sort) {
      case 'recent':
        supabaseQuery = supabaseQuery.order('created_at', { ascending: false });
        break;
      case 'popular':
        supabaseQuery = supabaseQuery.order('copy_count', { ascending: false });
        break;
      case 'views':
        supabaseQuery = supabaseQuery.order('view_count', { ascending: false });
        break;
      case 'favorites':
        supabaseQuery = supabaseQuery.order('favorite_count', { ascending: false });
        break;
      default:
        // For relevance with full-text search, PostgreSQL automatically ranks by weighted search_vector
        // (tags=A/highest, title=B/medium, description=C/lowest)
        // Use copy_count as secondary sort for non-search queries or tiebreaker
        if (query) {
          // When using textSearch, results are automatically ranked by relevance
          // Add copy_count as tiebreaker for equal relevance scores
          supabaseQuery = supabaseQuery.order('copy_count', { ascending: false });
        } else {
          // No search query, just show popular circuits
          supabaseQuery = supabaseQuery.order('copy_count', { ascending: false });
        }
    }

    // Limit results (max 100 for safety)
    supabaseQuery = supabaseQuery.limit(Math.min(limit, 100));

    const { data: circuits, error } = await supabaseQuery;

    if (error) {
      console.error('Search error:', error);
      throw error;
    }

    return NextResponse.json({
      circuits: circuits || [],
      count: circuits?.length || 0,
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Failed to search circuits' },
      { status: 500 }
    );
  }
}
