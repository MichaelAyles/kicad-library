/**
 * Server-side reads of public circuits for cacheable routes: the circuit
 * detail page and the sitemap.
 *
 * Uses the cookie-less anon client, so RLS only returns public circuits and the
 * result is the same for every visitor, which is what makes it safe to cache.
 * Private circuits are never returned here; the detail page falls back to the
 * browser fetch (with the owner's session) for those.
 */

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { validateSExpression } from "@/lib/kicad-parser";
import {
  summarizeMetadata,
  type CircuitPartsSummary,
} from "@/lib/circuit-summary";
import type { Circuit } from "@/lib/circuits";

/**
 * A circuit as rendered by the detail page, without the (large) raw
 * S-expression. (is_featured is declared on Circuit but has no DB column.)
 */
export type CircuitView = Omit<
  Circuit,
  "raw_sexpr" | "file_path" | "is_featured"
>;

export interface PublicCircuitPage {
  circuit: CircuitView;
  /** Parsed parts list and stats, or null if the schematic didn't parse. */
  parts: CircuitPartsSummary | null;
}

const DETAIL_COLUMNS = `
  id, slug, title, description, user_id, raw_sexpr, schematic_r2_url, tags,
  category, license, view_count, copy_count, favorite_count, comment_count,
  thumbnail_light_url, thumbnail_dark_url, thumbnail_version, is_public,
  sheet_size, github_owner, github_repo, created_at, updated_at,
  user:profiles(id, username, avatar_url)
`;

/**
 * Fetch a public circuit by slug and parse its parts list on the server.
 * Returns null if no public circuit has that slug. The raw S-expression is
 * parsed here and dropped, so it never reaches the HTML or RSC payload.
 *
 * Wrapped in React cache() so generateMetadata and the page share one query.
 */
export const getPublicCircuitPage = cache(
  async (slug: string): Promise<PublicCircuitPage | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("circuits")
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (error) {
      // Throw rather than return null: during ISR revalidation this keeps
      // serving the previous page instead of caching a "not found" fallback.
      throw new Error(`Failed to load circuit "${slug}": ${error.message}`);
    }
    if (!data) return null;

    const { raw_sexpr, ...circuit } = data as unknown as Circuit;

    let parts: CircuitPartsSummary | null = null;
    try {
      const validation = validateSExpression(raw_sexpr);
      if (validation.valid && validation.metadata) {
        parts = summarizeMetadata(validation.metadata);
      }
    } catch (err) {
      console.error(`Failed to parse schematic for "${slug}":`, err);
    }

    return { circuit, parts };
  },
);

// PostgREST returns at most 1000 rows per request
const SITEMAP_PAGE_SIZE = 1000;

/**
 * List every public circuit's slug and last update, paging past PostgREST's
 * row cap. Throws on any query error so an ISR revalidation keeps the last
 * good result instead of caching a partial list.
 */
export async function listPublicCircuitSlugs(): Promise<
  Array<{ slug: string; updated_at: string | null }>
> {
  const supabase = createPublicClient();
  const rows: Array<{ slug: string; updated_at: string | null }> = [];

  for (let from = 0; ; from += SITEMAP_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("circuits")
      .select("slug, updated_at")
      .eq("is_public", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to list public circuits: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < SITEMAP_PAGE_SIZE) break;
  }

  return rows;
}
