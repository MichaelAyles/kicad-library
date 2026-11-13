/**
 * Server-side authorization helpers for API routes.
 *
 * Admin status is read from `app_metadata.role`, which can only be written
 * with the service role key. Never use `user_metadata` for authorization:
 * users can set it themselves via `supabase.auth.updateUser()`.
 */

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminKey } from "@/lib/admin-auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function userIsAdmin(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}

/** Returns the authenticated user from the request cookies, or null. */
export async function getRequestUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export type CircuitAccess =
  | {
      ok: true;
      user: User;
      isAdmin: boolean;
      /** The row read for the ownership check, so callers needn't refetch. */
      circuit: { user_id: string; thumbnail_version: number | null };
    }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/**
 * Verify the request comes from the circuit's owner or an admin.
 */
export async function requireCircuitOwnerOrAdmin(
  circuitId: unknown,
): Promise<CircuitAccess> {
  if (!isUuid(circuitId)) {
    return { ok: false, status: 400, error: "Invalid circuitId" };
  }

  const user = await getRequestUser();
  if (!user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const { data: circuit, error } = await createAdminClient()
    .from("circuits")
    .select("user_id, thumbnail_version")
    .eq("id", circuitId)
    .single();

  if (error || !circuit) {
    return { ok: false, status: 404, error: "Circuit not found" };
  }

  const isAdmin = userIsAdmin(user);
  if (circuit.user_id !== user.id && !isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user, isAdmin, circuit };
}

type AdminDenied = { ok: false; status: 401 | 403; error: string };
type AdminSession = { ok: true; user: User; via: "session" };
type AdminApiKey = { ok: true; user: null; via: "apiKey" };
export type AdminAccess = AdminSession | AdminApiKey | AdminDenied;

/**
 * Verify the request comes from an admin.
 *
 * Accepts, in order:
 * 1. The `ADMIN_API_KEY` as a Bearer token (timing-safe compare), only when
 *    `allowApiKey` is set. Used by scripts such as the batch importer; there
 *    is no user, so `user` is null.
 * 2. A Supabase access token as a Bearer token (what the admin page sends).
 * 3. The Supabase session cookies.
 *
 * The user must have `app_metadata.role === "admin"`.
 */
export async function requireAdmin(
  request: Request,
): Promise<AdminSession | AdminDenied>;
export async function requireAdmin(
  request: Request,
  options: { allowApiKey: boolean },
): Promise<AdminAccess>;
export async function requireAdmin(
  request: Request,
  { allowApiKey = false }: { allowApiKey?: boolean } = {},
): Promise<AdminAccess> {
  const authHeader = request.headers.get("Authorization");

  if (allowApiKey && verifyAdminKey(authHeader)) {
    return { ok: true, user: null, via: "apiKey" };
  }

  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  let user: User | null;
  if (token) {
    const { data, error } = await createAdminClient().auth.getUser(token);
    if (error || !data.user) {
      return { ok: false, status: 401, error: "Unauthorized - Invalid token" };
    }
    user = data.user;
  } else {
    user = await getRequestUser();
    if (!user) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
  }

  if (!userIsAdmin(user)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden - Admin access required",
    };
  }

  return { ok: true, user, via: "session" };
}
