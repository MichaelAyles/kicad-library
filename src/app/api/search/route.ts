import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, publicCacheHeaders } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

// Sort column for each sort option (applied in SQL before pagination)
const SORT_COLUMNS: Record<string, string> = {
  recent: "created_at",
  popular: "copy_count",
  views: "view_count",
  favorites: "favorite_count",
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createPublicClient();
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const tag = searchParams.get("tag") || "";
    const license = searchParams.get("license") || "";
    const sort = searchParams.get("sort") || "relevance";
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    // Without a query there's no relevance score; default to popular
    const sortColumn = SORT_COLUMNS[sort] ?? "copy_count";
    const excludeImported = searchParams.get("excludeImported") === "true";

    // Build base query
    let circuits: any[] = [];

    if (query) {
      // Use hybrid search: combine full-text search with pattern matching
      // This ensures we catch exact matches while still using weighted search_vector
      const searchQuery = query.trim();

      // Search with weights: tags (highest), title (medium), description (lowest)
      // Using custom SQL to leverage ts_rank with weighted search_vector
      const { data, error } = await supabase.rpc("search_circuits_weighted", {
        search_query: searchQuery,
        filter_category: category || null,
        filter_tag: tag || null,
        filter_license: license || null,
        exclude_user_id: null, // Deprecated - using exclude_imported instead
        exclude_imported: excludeImported,
        result_limit: limit,
        result_offset: offset,
      });

      if (error) {
        console.error(
          "Weighted search error, falling back to simple search:",
          error,
        );
        // Fallback to simple pattern matching if RPC fails
        let fallbackQuery = supabase
          .from("circuits")
          .select(
            `
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
          `,
          )
          .eq("is_public", true);

        // Strip PostgREST filter syntax and LIKE wildcards from user input so
        // it can't alter the .or() filter structure.
        const safeQuery = searchQuery.replace(/[,(){}"\\%*]/g, " ").trim();
        if (safeQuery) {
          fallbackQuery = fallbackQuery.or(
            `tags.cs.{"${safeQuery}"},title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`,
          );
        }

        if (category) fallbackQuery = fallbackQuery.eq("category", category);
        if (tag) fallbackQuery = fallbackQuery.contains("tags", [tag]);
        if (license) fallbackQuery = fallbackQuery.eq("license", license);
        if (excludeImported) {
          fallbackQuery = fallbackQuery.is("batch_import_id", null);
        }

        fallbackQuery = fallbackQuery
          .order(sortColumn, { ascending: false })
          .order("id")
          .range(offset, offset + limit - 1);

        const fallbackResult = await fallbackQuery;
        if (fallbackResult.error) throw fallbackResult.error;
        circuits = fallbackResult.data || [];
      } else {
        circuits = data || [];
      }
    } else {
      // No search query - just apply filters
      let supabaseQuery = supabase
        .from("circuits")
        .select(
          `
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
        `,
        )
        .eq("is_public", true);

      if (category) supabaseQuery = supabaseQuery.eq("category", category);
      if (tag) supabaseQuery = supabaseQuery.contains("tags", [tag]);
      if (license) supabaseQuery = supabaseQuery.eq("license", license);
      if (excludeImported) {
        supabaseQuery = supabaseQuery.is("batch_import_id", null);
      }

      supabaseQuery = supabaseQuery
        .order(sortColumn, { ascending: false })
        .order("id")
        .range(offset, offset + limit - 1);

      const { data, error: listError } = await supabaseQuery;
      if (listError) throw listError;
      circuits = data || [];
    }

    // The weighted-search RPC only orders by relevance, so other sorts are
    // applied to the returned page. (Non-query and fallback paths sort in SQL.)
    if (query && sort !== "relevance" && SORT_COLUMNS[sort]) {
      const col = SORT_COLUMNS[sort];
      circuits = circuits.sort((a, b) =>
        col === "created_at"
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : (b[col] || 0) - (a[col] || 0),
      );
    }

    return NextResponse.json(
      { circuits: circuits || [], count: circuits?.length || 0 },
      { headers: publicCacheHeaders(60) },
    );
  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      { error: "Failed to search circuits" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
