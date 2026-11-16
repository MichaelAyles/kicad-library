import { createClient } from "@/lib/supabase/client";

/**
 * fetch() for the CircuitSnips API that sends the signed-in user's access
 * token as `Authorization: Bearer <token>`.
 *
 * The API runs in a separate Cloudflare Worker and the site is static, so
 * there are no server-side session cookies: the token is the only way the API
 * knows who is calling. This is the one place the token is read, so switching
 * identity providers only changes getAccessToken().
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/** The current session's access token, refreshed if it has expired. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
