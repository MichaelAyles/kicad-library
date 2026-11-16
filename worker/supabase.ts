/**
 * Supabase clients for the API worker. All are stateless (no session
 * persistence, no refresh): every request builds its own from `env`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env";

const STATELESS = { persistSession: false, autoRefreshToken: false } as const;

/** Service-role client. Bypasses RLS: admin operations only. */
export function createAdminClient(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables for admin client");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: STATELESS,
  });
}

/**
 * Anon client with no user. Responses depend only on the request, so they
 * are safe to cache publicly; RLS treats every query as anonymous.
 */
export function createPublicClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: STATELESS,
  });
}

/**
 * Anon client acting as the caller: PostgREST sees their access token, so
 * RLS policies and the guard_circuit_writes trigger apply as they would to
 * the browser. Only valid for tokens Supabase itself accepts.
 */
export function createUserClient(env: Env, token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: STATELESS,
  });
}
