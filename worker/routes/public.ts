/**
 * Public, read-only, edge-cached routes: search, stats, tags and the
 * schematic redirect. Ports of src/app/api/{search,stats,tags,schematic}.
 */

import { Hono } from "hono";
import type { SheetSize } from "../../src/lib/kicad-parser";
import type { AppEnv } from "../env";
import { edgeCache } from "../middleware";
import { createCircuitStorage } from "../r2";
import { createAdminClient, createPublicClient } from "../supabase";

/** Cache-Control for public GET responses stored by edgeCache(). */
export function publicCacheHeaders(sMaxAge: number, swr = sMaxAge * 10) {
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}

const publicRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// GET /api/search
// ---------------------------------------------------------------------------

// Sort column for each sort option (applied in SQL before pagination)
const SORT_COLUMNS: Record<string, string> = {
  recent: "created_at",
  popular: "copy_count",
  views: "view_count",
  favorites: "favorite_count",
};

const CIRCUIT_CARD_COLUMNS = `
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
`;

publicRoutes.get("/api/search", edgeCache(), async (c) => {
  try {
    const supabase = createPublicClient(c.env);

    const query = c.req.query("q") || "";
    const category = c.req.query("category") || "";
    const tag = c.req.query("tag") || "";
    const license = c.req.query("license") || "";
    const sort = c.req.query("sort") || "relevance";
    const limit = Math.min(
      Math.max(parseInt(c.req.query("limit") || "50", 10) || 50, 1),
      100,
    );
    const offset = Math.max(
      parseInt(c.req.query("offset") || "0", 10) || 0,
      0,
    );
    // Without a query there's no relevance score; default to popular
    const sortColumn = SORT_COLUMNS[sort] ?? "copy_count";
    const excludeImported = c.req.query("excludeImported") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let circuits: any[] = [];

    if (query) {
      // Weighted full-text search: tags (A), title (B), description (C)
      const searchQuery = query.trim();
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
        let fallbackQuery = supabase
          .from("circuits")
          .select(CIRCUIT_CARD_COLUMNS)
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

        const fallbackResult = await fallbackQuery
          .order(sortColumn, { ascending: false })
          .order("id")
          .range(offset, offset + limit - 1);
        if (fallbackResult.error) throw fallbackResult.error;
        circuits = fallbackResult.data || [];
      } else {
        circuits = data || [];
      }
    } else {
      // No search query - just apply filters
      let supabaseQuery = supabase
        .from("circuits")
        .select(CIRCUIT_CARD_COLUMNS)
        .eq("is_public", true);

      if (category) supabaseQuery = supabaseQuery.eq("category", category);
      if (tag) supabaseQuery = supabaseQuery.contains("tags", [tag]);
      if (license) supabaseQuery = supabaseQuery.eq("license", license);
      if (excludeImported) {
        supabaseQuery = supabaseQuery.is("batch_import_id", null);
      }

      const { data, error: listError } = await supabaseQuery
        .order(sortColumn, { ascending: false })
        .order("id")
        .range(offset, offset + limit - 1);
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

    return c.json(
      { circuits: circuits || [], count: circuits?.length || 0 },
      200,
      publicCacheHeaders(60),
    );
  } catch (error) {
    console.error("Error in search API:", error);
    return c.json({ error: "Failed to search circuits" }, 500, {
      "Cache-Control": "no-store",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------------------

publicRoutes.get("/api/stats", edgeCache(), async (c) => {
  const cache = publicCacheHeaders(300);
  try {
    const supabase = createPublicClient(c.env);

    // Single-row cache table
    const { data: globalStats, error: statsError } = await supabase
      .from("global_stats")
      .select("total_circuits, total_copies, total_users, last_synced_at")
      .eq("id", 1)
      .single();

    if (statsError) {
      console.error("Error fetching global stats:", statsError);
      console.log("Falling back to aggregation method...");

      const { count: circuitCount } = await supabase
        .from("circuits")
        .select("*", { count: "exact", head: true })
        .eq("is_public", true);

      const { count: makerCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      return c.json(
        {
          circuits: circuitCount || 0,
          copies: 0, // Can't efficiently calculate without migration
          makers: makerCount || 0,
        },
        200,
        cache,
      );
    }

    return c.json(
      {
        circuits: globalStats.total_circuits || 0,
        copies: globalStats.total_copies || 0,
        makers: globalStats.total_users || 0,
        lastSynced: globalStats.last_synced_at,
      },
      200,
      cache,
    );
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/tags
// ---------------------------------------------------------------------------

// Matches PostgREST's max-rows cap on a single response
const TAGS_PAGE_SIZE = 1000;

publicRoutes.get("/api/tags", edgeCache(), async (c) => {
  try {
    const supabase = createPublicClient(c.env);

    // Page through every public circuit's tags. A single unpaginated select
    // is capped at 1000 rows, so it would only count an arbitrary subset.
    const circuits: { tags: string[] | null }[] = [];
    for (let from = 0; ; from += TAGS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("circuits")
        .select("tags")
        .eq("is_public", true)
        .order("id")
        .range(from, from + TAGS_PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching circuits:", error);
        throw error;
      }

      circuits.push(...(data ?? []));
      if (!data || data.length < TAGS_PAGE_SIZE) break;
    }

    const tagCounts = new Map<string, number>();
    for (const circuit of circuits) {
      if (!Array.isArray(circuit.tags)) continue;
      for (const tag of circuit.tags) {
        const normalizedTag = tag.toLowerCase().trim();
        if (normalizedTag) {
          tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
        }
      }
    }

    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return c.json({ tags: popularTags }, 200, publicCacheHeaders(3600));
  } catch (error) {
    console.error("Error in tags API:", error);
    return c.json({ error: "Failed to fetch popular tags" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/schematic/:filename
// ---------------------------------------------------------------------------

function placeholderSchematic(title: string, comment: string): string {
  return `(kicad_sch (version 20230121) (generator "CircuitSnips")
  (uuid 00000000-0000-0000-0000-000000000000)
  (paper "A4")
  (title_block
    (title "${title}")
    (comment 1 "${comment}")
  )
)`;
}

/** Redirects are cacheable so repeats are served without a DB lookup. */
const REDIRECT_CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Serve a schematic for KiCanvas. Lazy write-through cache: if the circuit
 * already has a processed schematic in R2, redirect there. Otherwise process
 * once, upload to R2, record the URL and redirect.
 */
publicRoutes.get("/api/schematic/:filename", edgeCache(), async (c) => {
  const filename = c.req.param("filename");
  const plainHeaders = (cacheControl: string) => ({
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `inline; filename="${filename.replace(/["\\\r\n]/g, "")}"`,
    "Cache-Control": cacheControl,
  });

  try {
    // e.g. "8k2-r.kicad_sch" -> "8k2-r"
    const slug = filename.replace(".kicad_sch", "");

    // Anonymous read: RLS only exposes public circuits (as before, when this
    // used the cookie-less browser client)
    const { data: circuit, error } = await createPublicClient(c.env)
      .from("circuits")
      .select("id, title, sheet_size, raw_sexpr, schematic_r2_url")
      .eq("slug", slug)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!circuit) {
      // An empty sheet instead of a 404, so hierarchical sheet references
      // that aren't in the database don't crash KiCanvas
      return c.body(
        placeholderSchematic(
          "Sheet Not Found",
          "This hierarchical sheet is not available",
        ),
        200,
        plainHeaders("public, max-age=31536000, immutable"),
      );
    }

    // Fast path: redirect to the CDN-cached schematic
    if (circuit.schematic_r2_url) {
      c.header("Cache-Control", REDIRECT_CACHE_CONTROL);
      return c.redirect(circuit.schematic_r2_url, 302);
    }

    const rawData: string | null = circuit.raw_sexpr;
    if (!rawData) {
      return c.json({ error: "Circuit data not found" }, 404);
    }

    const trimmedData = rawData.trim();
    if (
      trimmedData.startsWith("<!DOCTYPE") ||
      trimmedData.startsWith("<html") ||
      trimmedData.startsWith("<?xml")
    ) {
      console.error(
        `Circuit ${slug} contains corrupted data (HTML/XML instead of schematic)`,
      );
      return c.body(
        placeholderSchematic(
          "Corrupted Data",
          "This circuit contains invalid data and cannot be displayed",
        ),
        200,
        plainHeaders("no-cache"),
      );
    }

    if (!trimmedData.startsWith("(")) {
      console.error(`Circuit ${slug} data is not a valid KiCad S-expression`);
      return c.body(
        placeholderSchematic(
          "Invalid Data",
          "This circuit contains invalid data and cannot be displayed",
        ),
        200,
        plainHeaders("no-cache"),
      );
    }

    // Slow path: process, upload to R2, remember the URL
    const r2Url = await createCircuitStorage(c.env).processAndUploadSchematic({
      circuitId: circuit.id,
      rawSexpr: rawData,
      title: circuit.title,
      sheetSizeOverride: (circuit.sheet_size as SheetSize) || null,
    });

    const { error: dbError } = await createAdminClient(c.env)
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", circuit.id);
    if (dbError) {
      // Non-fatal: the processed file is in R2 either way
      console.error(`Failed to update schematic_r2_url for ${slug}:`, dbError);
    }

    c.header("Cache-Control", REDIRECT_CACHE_CONTROL);
    return c.redirect(r2Url, 302);
  } catch (error) {
    console.error("Failed to serve schematic:", error);
    return c.json({ error: "Failed to serve schematic file" }, 500);
  }
});

export default publicRoutes;
