/**
 * Minimal WorkOS User Management client (server-side, needs WORKOS_API_KEY).
 *
 * Only what the API needs: look users up, link them to our profile id via
 * `external_id`, and delete them with their account.
 */

const WORKOS_API = "https://api.workos.com";

export interface WorkosUser {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  external_id: string | null;
}

export class WorkosApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const response = await fetch(`${WORKOS_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new WorkosApiError(
      response.status,
      `WorkOS ${method} ${path.split("/").slice(0, 3).join("/")} failed: ${response.status}`,
    );
  }
  if (response.status === 202 || response.status === 204) return null;
  return (await response.json()) as T;
}

export function createWorkosClient(apiKey: string) {
  return {
    getUser: (id: string) =>
      call<WorkosUser>(
        apiKey,
        "GET",
        `/user_management/users/${encodeURIComponent(id)}`,
      ),
    getUserByExternalId: (externalId: string) =>
      call<WorkosUser>(
        apiKey,
        "GET",
        `/user_management/users/external_id/${encodeURIComponent(externalId)}`,
      ),
    setExternalId: (id: string, externalId: string) =>
      call<WorkosUser>(
        apiKey,
        "PUT",
        `/user_management/users/${encodeURIComponent(id)}`,
        { external_id: externalId },
      ),
    deleteUser: (id: string) =>
      call<null>(
        apiKey,
        "DELETE",
        `/user_management/users/${encodeURIComponent(id)}`,
      ),
  };
}

export type WorkosClient = ReturnType<typeof createWorkosClient>;

/**
 * The profile id for a WorkOS user who has none yet, derived from their
 * WorkOS id (a name-based UUID: SHA-256, version 5 layout). Deterministic, so
 * a retried first sign-in always lands on the same profile.
 */
export async function profileIdForWorkosUser(workosUserId: string): Promise<string> {
  const data = new TextEncoder().encode(`circuitsnips:workos:${workosUserId}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
