import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
} from "jose";
import type { AppEnv } from "../../worker/env";
import { fakeSupabase, testEnv } from "./helpers";

// WorkOS JWKS: served from a local key set instead of api.workos.com
const jwks: { current: JSONWebKeySet } = { current: { keys: [] } };
vi.mock("jose", async (importOriginal) => {
  const jose = await importOriginal<typeof import("jose")>();
  return {
    ...jose,
    createRemoteJWKSet: () => (...args: Parameters<ReturnType<typeof jose.createLocalJWKSet>>) =>
      jose.createLocalJWKSet(jwks.current)(...args),
  };
});

// Supabase verification goes through createPublicClient().auth.getUser
const getUser = vi.fn();
vi.mock("../../worker/supabase", () => ({
  createPublicClient: () => fakeSupabase(undefined, { getUser }),
  createAdminClient: () => fakeSupabase(),
  createUserClient: () => fakeSupabase(),
}));

const auth = await import("../../worker/auth");
const {
  bearerToken,
  getRequestUser,
  requireAdmin,
  selectTokenKind,
  tokenVerifiers,
  verifySupabaseToken,
  verifyWorkosToken,
} = auth;

const USER_ID = "11111111-2222-4333-8444-555555555555";
const WORKOS = { WORKOS_CLIENT_ID: "client_123" };

let signingKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks.current = { keys: [{ ...jwk, kid: "k1", alg: "RS256" }] };
  createLocalJWKSet(jwks.current); // sanity: valid key set
});

afterEach(() => {
  vi.restoreAllMocks();
  getUser.mockReset();
});

function workosToken(
  claims: Record<string, unknown>,
  {
    key = signingKey,
    iss = "https://api.workos.com/user_management/client_123",
    exp = "5m",
  }: { key?: CryptoKey; iss?: string; exp?: string | number } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(iss)
    .setSubject("user_01WORKOS")
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

/** An unsigned token with the given issuer (only `iss` is read from it). */
function unsignedToken(iss: string) {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ iss, sub: USER_ID })}.sig`;
}

/** A tiny app that echoes getRequestUser(). */
function whoAmI() {
  const app = new Hono<AppEnv>();
  app.get("/me", async (c) => c.json({ user: await getRequestUser(c) }));
  return app;
}

describe("bearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer   abc ")).toBe("abc");
  });
  it("rejects missing or non-Bearer headers", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
  });
});

describe("selectTokenKind", () => {
  it("sends every token to Supabase when WorkOS isn't configured", () => {
    const env = testEnv();
    expect(selectTokenKind(unsignedToken("https://api.workos.com"), env)).toBe(
      "supabase",
    );
    expect(selectTokenKind("not-a-jwt", env)).toBe("supabase");
  });

  it("routes WorkOS-issued tokens to WorkOS when configured", () => {
    const env = testEnv(WORKOS);
    expect(
      selectTokenKind(
        unsignedToken("https://api.workos.com/user_management/client_123"),
        env,
      ),
    ).toBe("workos");
    expect(
      selectTokenKind(unsignedToken("https://project.supabase.co/auth/v1"), env),
    ).toBe("supabase");
  });

  it("honours a custom WORKOS_ISSUER", () => {
    const env = testEnv({ ...WORKOS, WORKOS_ISSUER: "https://auth.example.com" });
    expect(selectTokenKind(unsignedToken("https://auth.example.com"), env)).toBe(
      "workos",
    );
  });

  it("rejects undecodable tokens when it has to choose", () => {
    expect(selectTokenKind("garbage", testEnv(WORKOS))).toBeNull();
  });
});

describe("getRequestUser routing", () => {
  it("returns null without a token, without calling a verifier", async () => {
    const supabase = vi.spyOn(tokenVerifiers, "supabase");
    const res = await whoAmI().request("/me", {}, testEnv());
    expect(await res.json()).toEqual({ user: null });
    expect(supabase).not.toHaveBeenCalled();
  });

  it("uses the Supabase verifier by default", async () => {
    const supabase = vi
      .spyOn(tokenVerifiers, "supabase")
      .mockResolvedValue({ id: USER_ID, isAdmin: false });
    const workos = vi.spyOn(tokenVerifiers, "workos");
    const res = await whoAmI().request(
      "/me",
      { headers: { Authorization: "Bearer supa-token" } },
      testEnv(),
    );
    expect(await res.json()).toEqual({
      user: { id: USER_ID, isAdmin: false, token: "supa-token" },
    });
    expect(supabase).toHaveBeenCalledOnce();
    expect(workos).not.toHaveBeenCalled();
  });

  it("uses the WorkOS verifier for WorkOS tokens when configured", async () => {
    const token = unsignedToken("https://api.workos.com/user_management/x");
    const supabase = vi.spyOn(tokenVerifiers, "supabase");
    const workos = vi
      .spyOn(tokenVerifiers, "workos")
      .mockResolvedValue({ id: USER_ID, isAdmin: true });
    const res = await whoAmI().request(
      "/me",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(WORKOS),
    );
    expect(((await res.json()) as { user: unknown }).user).toMatchObject({ id: USER_ID, isAdmin: true });
    expect(workos).toHaveBeenCalledOnce();
    expect(supabase).not.toHaveBeenCalled();
  });

  it("treats a verifier error as unauthenticated", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(tokenVerifiers, "supabase").mockRejectedValue(new Error("down"));
    const res = await whoAmI().request(
      "/me",
      { headers: { Authorization: "Bearer t" } },
      testEnv(),
    );
    expect(await res.json()).toEqual({ user: null });
  });
});

describe("verifySupabaseToken", () => {
  it("reads admin from app_metadata only, never user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          app_metadata: {},
          user_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    expect(await verifySupabaseToken("t", testEnv())).toEqual({
      id: USER_ID,
      isAdmin: false,
    });

    getUser.mockResolvedValue({
      data: { user: { id: USER_ID, app_metadata: { role: "admin" } } },
      error: null,
    });
    expect(await verifySupabaseToken("t", testEnv())).toEqual({
      id: USER_ID,
      isAdmin: true,
    });
  });

  it("rejects tokens Supabase rejects", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });
    expect(await verifySupabaseToken("t", testEnv())).toBeNull();
  });
});

describe("verifyWorkosToken", () => {
  it("accepts a valid token and maps uid / app_role", async () => {
    const token = await workosToken({ uid: USER_ID, app_role: "admin" });
    expect(await verifyWorkosToken(token, testEnv(WORKOS))).toEqual({
      id: USER_ID,
      isAdmin: true,
    });
    const member = await workosToken({ uid: USER_ID, role: "admin" });
    expect(await verifyWorkosToken(member, testEnv(WORKOS))).toEqual({
      id: USER_ID,
      isAdmin: false,
    });
  });

  it("rejects bad signatures, expired tokens, bad uids and wrong issuers", async () => {
    const env = testEnv(WORKOS);
    expect(
      await verifyWorkosToken(
        await workosToken({ uid: USER_ID }, { key: otherKey }),
        env,
      ),
    ).toBeNull();
    expect(
      await verifyWorkosToken(
        await workosToken(
          { uid: USER_ID },
          { exp: Math.floor(Date.now() / 1000) - 60 },
        ),
        env,
      ),
    ).toBeNull();
    expect(
      await verifyWorkosToken(await workosToken({ uid: "user_01" }), env),
    ).toBeNull();
    expect(
      await verifyWorkosToken(
        await workosToken({ uid: USER_ID }),
        testEnv({ ...WORKOS, WORKOS_ISSUER: "https://auth.example.com" }),
      ),
    ).toBeNull();
  });

  it("is disabled without WORKOS_CLIENT_ID", async () => {
    const token = await workosToken({ uid: USER_ID });
    expect(await verifyWorkosToken(token, testEnv())).toBeNull();
  });
});

describe("requireAdmin", () => {
  function adminApp(allowApiKey: boolean) {
    const app = new Hono<AppEnv>();
    app.post("/x", async (c) => {
      const access = await requireAdmin(c, { allowApiKey });
      return access.ok
        ? c.json({ via: access.via })
        : c.json({ error: access.error }, access.status);
    });
    return app;
  }
  const withKey = { headers: { Authorization: "Bearer the-admin-key" } };
  const env = testEnv({ ADMIN_API_KEY: "the-admin-key" });

  it("accepts ADMIN_API_KEY only where allowed", async () => {
    vi.spyOn(tokenVerifiers, "supabase").mockResolvedValue(null);
    const allowed = await adminApp(true).request("/x", { method: "POST", ...withKey }, env);
    expect(await allowed.json()).toEqual({ via: "apiKey" });

    const denied = await adminApp(false).request("/x", { method: "POST", ...withKey }, env);
    expect(denied.status).toBe(401);
  });

  it("never matches an unset ADMIN_API_KEY", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(tokenVerifiers, "supabase").mockResolvedValue(null);
    const res = await adminApp(true).request(
      "/x",
      { method: "POST", headers: { Authorization: "Bearer undefined" } },
      testEnv(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized - Invalid token" });
  });

  it("returns 401 without a token and 403 for non-admins", async () => {
    expect(
      (await adminApp(false).request("/x", { method: "POST" }, env)).status,
    ).toBe(401);

    vi.spyOn(tokenVerifiers, "supabase").mockResolvedValue({
      id: USER_ID,
      isAdmin: false,
    });
    const res = await adminApp(false).request(
      "/x",
      { method: "POST", headers: { Authorization: "Bearer user" } },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("accepts admin sessions", async () => {
    vi.spyOn(tokenVerifiers, "supabase").mockResolvedValue({
      id: USER_ID,
      isAdmin: true,
    });
    const res = await adminApp(false).request(
      "/x",
      { method: "POST", headers: { Authorization: "Bearer admin" } },
      env,
    );
    expect(await res.json()).toEqual({ via: "session" });
  });
});
