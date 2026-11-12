/**
 * Supabase client for public, cacheable API routes.
 *
 * Uses the anon key with no cookies/session, so responses depend only on the
 * request URL and are safe to cache at the CDN. Never use this for anything
 * user-specific; RLS treats every request as anonymous.
 */

import { createClient } from "@supabase/supabase-js";

export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Cache-Control for public GET responses served from Vercel's edge cache. */
export function publicCacheHeaders(sMaxAge: number, swr = sMaxAge * 10) {
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}
