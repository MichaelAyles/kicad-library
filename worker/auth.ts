/**
 * Request authentication for the API worker.
 *
 * There are no cookies: the browser sends `Authorization: Bearer <access
 * token>`. Two token issuers are supported:
 *
 * 1. Supabase Auth (today): verified by Supabase (`auth.getUser(token)`).
 *    Admin = `app_metadata.role === "admin"`. app_metadata can only be written
 *    with the service role; NEVER use user_metadata, which users can edit.
 * 2. WorkOS AuthKit (when WORKOS_CLIENT_ID is set): verified locally against
 *    the client's JWKS. `uid` carries our Supabase user uuid and `app_role`
 *    the admin role (both from a WorkOS JWT template).
 *
 * The verifier is chosen from the token's unverified `iss`; the chosen
 * verifier then checks the signature, so a forged `iss` only picks which
 * check the token fails.
 */

import type { Context } from "hono";
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { verifyAdminKey } from "../src/lib/admin-auth";
import type { AppEnv, Env, RequestUser } from "./env";
import { createAdminClient, createPublicClient } from "./supabase";

type Ctx = Context<AppEnv>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return token ? token : null;
}

// ---------------------------------------------------------------------------
// Verifiers
// ---------------------------------------------------------------------------

export type VerifiedIdentity = { id: string; isAdmin: boolean };
export type TokenVerifier = (
  token: string,
  env: Env,
) => Promise<VerifiedIdentity | null>;
export type TokenKind = "supabase" | "workos";

/** Supabase Auth access token: ask Supabase who it belongs to. */
export const verifySupabaseToken: TokenVerifier = async (token, env) => {
  const { data, error } = await createPublicClient(env).auth.getUser(token);
  const user = data?.user;
  if (error || !user || !isUuid(user.id)) return null;
  return { id: user.id, isAdmin: user.app_metadata?.role === "admin" };
};

const WORKOS_API_ORIGIN = "https://api.workos.com";
const jwksByClient = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function workosJwks(clientId: string) {
  let jwks = jwksByClient.get(clientId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(
        `${WORKOS_API_ORIGIN}/sso/jwks/${encodeURIComponent(clientId)}`,
      ),
    );
    jwksByClient.set(clientId, jwks);
  }
  return jwks;
}

/**
 * Verify a WorkOS AuthKit access token's signature, expiry and issuer and
 * return its claims, or null. Doesn't require `uid`: /api/me uses this for
 * first sign-ins, before the user is linked to a profile.
 */
export async function verifyWorkosClaims(
  token: string,
  env: Env,
): Promise<JWTPayload | null> {
  if (!env.WORKOS_CLIENT_ID) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      workosJwks(env.WORKOS_CLIENT_ID),
      {
        algorithms: ["RS256"],
        ...(env.WORKOS_ISSUER ? { issuer: env.WORKOS_ISSUER } : {}),
      },
    );
    return payload;
  } catch {
    return null;
  }
}

/** WorkOS AuthKit access token linked to a profile (`uid` claim). */
export const verifyWorkosToken: TokenVerifier = async (token, env) => {
  const payload = await verifyWorkosClaims(token, env);
  if (!payload || !isUuid(payload.uid)) return null;
  return {
    id: payload.uid.toLowerCase(),
    isAdmin: payload.app_role === "admin",
  };
};

/**
 * Verifiers by token kind. A mutable object so tests can stub one
 * (`vi.spyOn(tokenVerifiers, "supabase")`) without network access.
 */
export const tokenVerifiers: Record<TokenKind, TokenVerifier> = {
  supabase: verifySupabaseToken,
  workos: verifyWorkosToken,
};

/**
 * Which verifier should check this token. Without WORKOS_CLIENT_ID every
 * token goes to Supabase. With it, tokens whose (unverified) issuer is WorkOS
 * go to WorkOS and everything else to Supabase. Returns null for a token that
 * isn't a decodable JWT when a choice has to be made.
 */
export function selectTokenKind(token: string, env: Env): TokenKind | null {
  if (!env.WORKOS_CLIENT_ID) return "supabase";
  let iss: string | undefined;
  try {
    iss = decodeJwt(token).iss;
  } catch {
    return null;
  }
  const isWorkos =
    typeof iss === "string" &&
    ((env.WORKOS_ISSUER !== undefined && iss === env.WORKOS_ISSUER) ||
      iss === WORKOS_API_ORIGIN ||
      iss.startsWith(`${WORKOS_API_ORIGIN}/`));
  return isWorkos ? "workos" : "supabase";
}

async function resolveRequestUser(c: Ctx): Promise<RequestUser | null> {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) return null;
  const kind = selectTokenKind(token, c.env);
  if (!kind) return null;
  try {
    const identity = await tokenVerifiers[kind](token, c.env);
    return identity ? { ...identity, token } : null;
  } catch (error) {
    // Never log the token itself
    console.error(`${kind} token verification failed:`, error);
    return null;
  }
}

/**
 * The authenticated caller, or null. Memoised per request, so routes and
 * helpers can call it freely.
 */
export function getRequestUser(c: Ctx): Promise<RequestUser | null> {
  let pending = c.get("requestUser");
  if (!pending) {
    pending = resolveRequestUser(c);
    c.set("requestUser", pending);
  }
  return pending;
}

// ---------------------------------------------------------------------------
// Authorization helpers (ports of src/lib/api-auth.ts)
// ---------------------------------------------------------------------------

export type CircuitAccess =
  | {
      ok: true;
      user: RequestUser;
      isAdmin: boolean;
      /** The row read for the ownership check, so callers needn't refetch. */
      circuit: { user_id: string; thumbnail_version: number | null };
    }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/** Verify the request comes from the circuit's owner or an admin. */
export async function requireCircuitOwnerOrAdmin(
  c: Ctx,
  circuitId: unknown,
): Promise<CircuitAccess> {
  if (!isUuid(circuitId)) {
    return { ok: false, status: 400, error: "Invalid circuitId" };
  }

  const user = await getRequestUser(c);
  if (!user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const { data: circuit, error } = await createAdminClient(c.env)
    .from("circuits")
    .select("user_id, thumbnail_version")
    .eq("id", circuitId)
    .single();

  if (error || !circuit) {
    return { ok: false, status: 404, error: "Circuit not found" };
  }

  if (circuit.user_id !== user.id && !user.isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user, isAdmin: user.isAdmin, circuit };
}

type AdminDenied = { ok: false; status: 401 | 403; error: string };
type AdminSession = { ok: true; user: RequestUser; via: "session" };
type AdminApiKey = { ok: true; user: null; via: "apiKey" };
export type AdminAccess = AdminSession | AdminApiKey | AdminDenied;

/**
 * Verify the request comes from an admin.
 *
 * Accepts, in order:
 * 1. The `ADMIN_API_KEY` as a Bearer token (timing-safe compare), only when
 *    `allowApiKey` is set. Used by scripts such as the batch importer; there
 *    is no user, so `user` is null.
 * 2. An access token (Supabase or WorkOS) whose user is an admin.
 */
export async function requireAdmin(c: Ctx): Promise<AdminSession | AdminDenied>;
export async function requireAdmin(
  c: Ctx,
  options: { allowApiKey: boolean },
): Promise<AdminAccess>;
export async function requireAdmin(
  c: Ctx,
  { allowApiKey = false }: { allowApiKey?: boolean } = {},
): Promise<AdminAccess> {
  const authHeader = c.req.header("Authorization") ?? null;

  // Pass "" rather than undefined so an unset key never falls back to
  // process.env inside verifyAdminKey; an empty key never matches.
  if (allowApiKey && verifyAdminKey(authHeader, c.env.ADMIN_API_KEY ?? "")) {
    return { ok: true, user: null, via: "apiKey" };
  }

  if (!bearerToken(authHeader)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const user = await getRequestUser(c);
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized - Invalid token" };
  }

  if (!user.isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden - Admin access required",
    };
  }

  return { ok: true, user, via: "session" };
}
