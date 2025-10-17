import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for Client Components
 * This client is used in the browser
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
