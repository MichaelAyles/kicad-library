import { createBrowserClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { AUTH_PROVIDER } from "@/lib/auth/config";
import { getAccessToken } from "@/lib/auth/session";

let workosClient: SupabaseClient | null = null;

/**
 * Create a Supabase client for Client Components (browser).
 *
 * Supabase Auth build: @supabase/ssr's browser client, which owns the session.
 * WorkOS build: Supabase third-party auth. The client sends the WorkOS access
 * token on every request (RLS reads our uuid from its `uid` claim), and
 * `supabase.auth.*` is unavailable: use useAuth()/getCurrentUser() instead.
 *
 * @throws {Error} If required environment variables are missing
 */
export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file. " +
        "See README.md for setup instructions.",
    );
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". Must be a valid URL.`,
    );
  }

  if (AUTH_PROVIDER === "workos") {
    workosClient ??= createSupabaseClient(supabaseUrl, supabaseKey, {
      accessToken: () => getAccessToken(),
    });
    return workosClient;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
