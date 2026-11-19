import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../worker/env";
import { requestRebuild } from "../../worker/rebuild";
import { testEnv } from "./helpers";

function rebuildApp() {
  const app = new Hono<AppEnv>();
  app.post("/change", (c) => {
    requestRebuild(c, "test");
    return c.json({ ok: true });
  });
  return app;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestRebuild", () => {
  it("does nothing without GITHUB_DEPLOY_TOKEN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await rebuildApp().request("/change", { method: "POST" }, testEnv());
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches the deploy workflow on main", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await rebuildApp().request(
      "/change",
      { method: "POST" },
      testEnv({ GITHUB_DEPLOY_TOKEN: "gh-token", GITHUB_REPOSITORY: "o/r" }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.github.com/repos/o/r/actions/workflows/deploy.yml/dispatches",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer gh-token",
    );
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main" });
  });

  it("doesn't fail the request when GitHub errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await rebuildApp().request(
      "/change",
      { method: "POST" },
      testEnv({ GITHUB_DEPLOY_TOKEN: "gh-token" }),
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
