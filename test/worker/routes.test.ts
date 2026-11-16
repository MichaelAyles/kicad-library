import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../worker/env";
import { fakeSupabase, freshIp, testEnv, type Resolver } from "./helpers";

// Each test sets the resolvers for the clients the routes create
const clients: { admin: Resolver; user: Resolver; public: Resolver } = {
  admin: () => ({ data: null, error: null }),
  user: () => ({ data: null, error: null }),
  public: () => ({ data: null, error: null }),
};
vi.mock("../../worker/supabase", () => ({
  createAdminClient: () => fakeSupabase((t, o) => clients.admin(t, o)),
  createUserClient: () => fakeSupabase((t, o) => clients.user(t, o)),
  createPublicClient: () => fakeSupabase((t, o) => clients.public(t, o)),
}));

const { app } = await import("../../worker/index");
const { tokenVerifiers } = await import("../../worker/auth");

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CIRCUIT = "33333333-3333-4333-8333-333333333333";

let env: Env;
beforeEach(() => {
  env = testEnv({ ADMIN_API_KEY: "admin-key" });
  clients.admin = () => ({ data: null, error: null });
  clients.user = () => ({ data: null, error: null });
  clients.public = () => ({ data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** Sign in as `id` (any Bearer token is accepted by the stub verifier). */
function signIn(id: string, isAdmin = false) {
  vi.spyOn(tokenVerifiers, "supabase").mockImplementation(async (token) =>
    token === "valid" ? { id, isAdmin } : null,
  );
}

function req(
  method: string,
  body?: unknown,
  { token, raw }: { token?: string; raw?: string } = {},
): RequestInit {
  const headers: Record<string, string> = {
    "cf-connecting-ip": freshIp(),
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  };
}

describe("POST /api/circuits", () => {
  it("returns 401 without a token", async () => {
    const res = await app.request("/api/circuits", req("POST", {}), env);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized - Please sign in" });
  });

  it("returns 401 for a token the verifier rejects", async () => {
    signIn(OWNER);
    const res = await app.request(
      "/api/circuits",
      req("POST", {}, { token: "forged" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON and for bodies failing the zod schema", async () => {
    signIn(OWNER);
    const badJson = await app.request(
      "/api/circuits",
      req("POST", undefined, { token: "valid", raw: "{not json" }),
      env,
    );
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({
      error: "Request body must be valid JSON",
    });

    const res = await app.request(
      "/api/circuits",
      req(
        "POST",
        {
          title: "LDO",
          tags: ["power"],
          license: "MIT",
          raw_sexpr: "(symbol)",
          user_id: OTHER, // not accepted: .strict()
        },
        { token: "valid" },
      ),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Invalid circuit data");
    expect(JSON.stringify(body.details)).toContain("user_id");
  });
});

describe("PUT/DELETE /api/circuits/:id", () => {
  it("returns 403 when the caller doesn't own the circuit", async () => {
    signIn(OTHER);
    clients.user = (table) =>
      table === "circuits"
        ? { data: { user_id: OWNER, slug: "ldo" }, error: null }
        : { data: null, error: null };

    const put = await app.request(
      `/api/circuits/${CIRCUIT}`,
      req("PUT", { title: "x" }, { token: "valid" }),
      env,
    );
    expect(put.status).toBe(403);

    const del = await app.request(
      `/api/circuits/${CIRCUIT}`,
      req("DELETE", undefined, { token: "valid" }),
      env,
    );
    expect(del.status).toBe(403);
    expect(env.SCHEMATICS_BUCKET.delete).not.toHaveBeenCalled();
  });

  it("rejects thumbnail URLs outside the circuit's R2 folder", async () => {
    signIn(OWNER);
    clients.user = () => ({ data: { user_id: OWNER }, error: null });
    const res = await app.request(
      `/api/circuits/${CIRCUIT}`,
      req(
        "PUT",
        {
          thumbnail_light_url: `https://pub.example.r2.dev/thumbnails/${OTHER}/v1-light.png`,
          thumbnail_dark_url: `https://pub.example.r2.dev/thumbnails/${CIRCUIT}/v1-dark.png`,
        },
        { token: "valid" },
      ),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid thumbnail URL" });
  });
});

describe("POST /api/upload-thumbnail and /api/upload-schematic", () => {
  it("returns 400 for a non-UUID circuitId", async () => {
    signIn(OWNER);
    const res = await app.request(
      "/api/upload-schematic",
      req("POST", { circuitId: "../etc" }, { token: "valid" }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid circuitId" });
  });

  it("returns 403 for a non-owner, non-admin caller", async () => {
    signIn(OTHER);
    clients.admin = () => ({
      data: { user_id: OWNER, thumbnail_version: 3 },
      error: null,
    });
    const res = await app.request(
      "/api/upload-thumbnail",
      req(
        "POST",
        { circuitId: CIRCUIT, lightDataUrl: "data:image/png;base64,AAAA" },
        { token: "valid" },
      ),
      env,
    );
    expect(res.status).toBe(403);
    expect(env.SCHEMATICS_BUCKET.put).not.toHaveBeenCalled();
  });

  it("rejects data that isn't a PNG", async () => {
    signIn(OWNER);
    clients.admin = () => ({
      data: { user_id: OWNER, thumbnail_version: 3 },
      error: null,
    });
    const notPng = Buffer.from("GIF89a-not-a-png").toString("base64");
    const res = await app.request(
      "/api/upload-thumbnail",
      req(
        "POST",
        { circuitId: CIRCUIT, lightDataUrl: `data:image/png;base64,${notPng}` },
        { token: "valid" },
      ),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Thumbnail is not a valid PNG" });
  });

  it("uploads a valid PNG under a fresh versioned key", async () => {
    signIn(OWNER);
    clients.admin = (table, ops) => {
      if (table === "circuits" && ops.includes("update")) {
        return { data: { thumbnail_version: 4 }, error: null };
      }
      if (table === "circuits") {
        return { data: { user_id: OWNER, thumbnail_version: 3 }, error: null };
      }
      return { data: null, error: null };
    };
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
    ]).toString("base64");
    const res = await app.request(
      "/api/upload-thumbnail",
      req(
        "POST",
        { circuitId: CIRCUIT, lightDataUrl: `data:image/png;base64,${png}` },
        { token: "valid" },
      ),
      env,
    );
    expect(res.status).toBe(200);
    const key = `thumbnails/${CIRCUIT}/v4-light.png`;
    expect(await res.json()).toEqual({
      success: true,
      circuitId: CIRCUIT,
      urls: { light: `https://pub.example.r2.dev/${key}` },
      version: 4,
    });
    expect(env.SCHEMATICS_BUCKET.put).toHaveBeenCalledWith(
      key,
      expect.any(Uint8Array),
      {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
      },
    );
  });
});

describe("admin routes", () => {
  it("return 401 without a token and 403 for non-admins", async () => {
    const anon = await app.request("/api/admin/sync-stats", req("POST"), env);
    expect(anon.status).toBe(401);

    signIn(OWNER, false);
    const user = await app.request(
      "/api/admin/delete-circuit",
      req("DELETE", { circuitId: CIRCUIT }, { token: "valid" }),
      env,
    );
    expect(user.status).toBe(403);
    expect(env.SCHEMATICS_BUCKET.delete).not.toHaveBeenCalled();
  });

  it("validates the circuitId for admins", async () => {
    signIn(OWNER, true);
    const res = await app.request(
      "/api/admin/delete-circuit",
      req("DELETE", { circuitId: "nope" }, { token: "valid" }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("accepts ADMIN_API_KEY on batch-import only", async () => {
    vi.spyOn(tokenVerifiers, "supabase").mockResolvedValue(null);
    const ok = await app.request(
      "/api/admin/batch-import",
      req("POST", {}, { token: "admin-key" }),
      env,
    );
    expect(ok.status).toBe(400);
    expect(await ok.json()).toEqual({
      error: 'Missing "records" array in request body',
    });

    const denied = await app.request(
      "/api/admin/sync-stats",
      req("POST", undefined, { token: "admin-key" }),
      env,
    );
    expect(denied.status).toBe(401);
  });

  it("stops an admin deleting their own account", async () => {
    signIn(OWNER, true);
    const res = await app.request(
      "/api/admin/delete-user",
      req("DELETE", { userId: OWNER }, { token: "valid" }),
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("public routes", () => {
  it("redirects to the stored R2 schematic with a cacheable 302", async () => {
    clients.public = () => ({
      data: {
        id: CIRCUIT,
        title: "LDO",
        sheet_size: null,
        raw_sexpr: "(kicad_sch)",
        schematic_r2_url: "https://pub.example.r2.dev/schematics/x.kicad_sch",
      },
      error: null,
    });
    const res = await app.request("/api/schematic/ldo.kicad_sch", {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      "https://pub.example.r2.dev/schematics/x.kicad_sch",
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
  });

  it("serves an empty sheet for unknown slugs", async () => {
    clients.public = () => ({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    const res = await app.request("/api/schematic/missing.kicad_sch", {}, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Sheet Not Found");
  });

  it("returns stats with a public s-maxage", async () => {
    clients.public = () => ({
      data: {
        total_circuits: 10,
        total_copies: 20,
        total_users: 3,
        last_synced_at: "2026-11-01T00:00:00Z",
      },
      error: null,
    });
    const res = await app.request("/api/stats", {}, env);
    expect(await res.json()).toEqual({
      circuits: 10,
      copies: 20,
      makers: 3,
      lastSynced: "2026-11-01T00:00:00Z",
    });
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=3000",
    );
  });
});

describe("unmatched requests", () => {
  it("fall through to serveAssetFallback (the ASSETS binding)", async () => {
    const res = await app.request("/circuit/some-slug", {}, env);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
    expect(await res.text()).toBe("asset fallback");
  });
});
