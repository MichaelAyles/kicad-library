import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../worker/env";
import { fakeSupabase, freshIp, testEnv } from "./helpers";

const admin = fakeSupabase() as ReturnType<typeof fakeSupabase> & {
  rpc: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>>;
};
vi.mock("../../worker/supabase", () => ({
  createAdminClient: () => admin,
  createUserClient: () => fakeSupabase(),
  createPublicClient: () => fakeSupabase(),
}));
const claims = vi.fn();
vi.mock("../../worker/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../worker/auth")>()),
  verifyWorkosClaims: (...args: unknown[]) => claims(...args),
}));

const { app } = await import("../../worker/index");
const { profileIdForWorkosUser } = await import("../../worker/workos");

const PROFILE = "11111111-1111-4111-8111-111111111111";
let env: Env;
let workosUser: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  env = testEnv({ WORKOS_CLIENT_ID: "client_x", WORKOS_API_KEY: "sk_test" });
  workosUser = {
    id: "user_01ABC",
    email: "new.person@example.com",
    email_verified: true,
    first_name: null,
    last_name: null,
    profile_picture_url: null,
    external_id: null,
  };
  claims.mockResolvedValue({ sub: "user_01ABC" });
  admin.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? Response.json({ ...workosUser, ...JSON.parse(String(init.body)) })
      : Response.json(workosUser),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const post = (token = "tok") =>
  app.request(
    "/api/me",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "cf-connecting-ip": freshIp() },
    },
    env,
  );

describe("POST /api/me", () => {
  it("returns 401 for a token that isn't a valid WorkOS token", async () => {
    claims.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the existing profile id of an imported user", async () => {
    workosUser.external_id = PROFILE;
    const res = await post();
    expect(await res.json()).toEqual({ id: PROFILE });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates a profile and links it for a new user, deterministically", async () => {
    const expected = await profileIdForWorkosUser("user_01ABC");
    expect(expected).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const res = await post();
    expect(await res.json()).toEqual({ id: expected });
    expect(admin.rpc).toHaveBeenCalledWith("ensure_profile", {
      p_id: expected,
      p_username: "new.person",
      p_avatar_url: null,
      p_github_url: null,
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[0]).toBe("https://api.workos.com/user_management/users/user_01ABC");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ external_id: expected });
  });

  it("doesn't link the user if creating the profile fails", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await post()).status).toBe(500);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("returns 503 without a WorkOS API key", async () => {
    env.WORKOS_API_KEY = undefined;
    expect((await post()).status).toBe(503);
  });
});
