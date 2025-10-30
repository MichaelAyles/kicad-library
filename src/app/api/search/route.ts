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

    // Build base query
    let circuits: any[] = [];

    if (query) {
      // Use hybrid search: combine full-text search with pattern matching
      // This ensures we catch exact matches while still using weighted search_vector
      const searchQuery = query.trim();

      // Search with weights: tags (highest), title (medium), description (lowest)
      // Using custom SQL to leverage ts_rank with weighted search_vector
      const { data, error } = await supabase.rpc('search_circuits_weighted', {
        search_query: searchQuery,
        filter_category: category || null,
        filter_tag: tag || null,
        filter_license: license || null,
        exclude_user_id: importerUserId,
        result_limit: Math.min(limit, 100)
      });

      if (error) {
        console.error('Weighted search error, falling back to simple search:', error);
        // Fallback to simple pattern matching if RPC fails
        let fallbackQuery = supabase
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
          .eq('is_public', true)
          .or(`tags.cs.{${searchQuery}},title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

        if (category) fallbackQuery = fallbackQuery.eq('category', category);
        if (tag) fallbackQuery = fallbackQuery.contains('tags', [tag]);
        if (license) fallbackQuery = fallbackQuery.eq('license', license);
        if (importerUserId && excludeImported) {
          fallbackQuery = fallbackQuery.neq('user_id', importerUserId);
        }

        fallbackQuery = fallbackQuery.limit(Math.min(limit, 100));

        const fallbackResult = await fallbackQuery;
        circuits = fallbackResult.data || [];
      } else {
        circuits = data || [];
      }
    } else {
      // No search query - just apply filters
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

      if (category) supabaseQuery = supabaseQuery.eq('category', category);
      if (tag) supabaseQuery = supabaseQuery.contains('tags', [tag]);
      if (license) supabaseQuery = supabaseQuery.eq('license', license);
      if (importerUserId && excludeImported) {
        supabaseQuery = supabaseQuery.neq('user_id', importerUserId);
      }

      supabaseQuery = supabaseQuery.limit(Math.min(limit, 100));

      const { data } = await supabaseQuery;
      circuits = data || [];
    }

    // Apply sorting (only for non-search queries, search results are pre-sorted by relevance)
    if (!query || sort !== 'relevance') {
      circuits = circuits.sort((a, b) => {
        switch (sort) {
          case 'recent':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case 'popular':
            return (b.copy_count || 0) - (a.copy_count || 0);
          case 'views':
            return (b.view_count || 0) - (a.view_count || 0);
          case 'favorites':
            return (b.favorite_count || 0) - (a.favorite_count || 0);
          default:
            // For relevance, results are already sorted by weighted search
            return 0;
        }
      });
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
