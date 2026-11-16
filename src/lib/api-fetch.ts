import { getAccessToken } from "@/lib/auth/session";

/**
 * fetch() for the CircuitSnips API that sends the signed-in user's access
 * token as `Authorization: Bearer <token>`.
 *
 * The API runs in a separate Cloudflare Worker and the site is static, so
 * there are no server-side session cookies: the token is the only way the API
 * knows who is calling. The token comes from whichever identity provider the
 * site was built for (src/lib/auth).
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
