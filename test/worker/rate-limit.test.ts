import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../worker/env";
import { clientIp, isRateLimitExempt, rateLimit } from "../../worker/middleware";
import { freshIp, testEnv } from "./helpers";

function limitedApp(maxRequests: number) {
  const app = new Hono<AppEnv>();
  app.use("/api/*", rateLimit({ maxRequests, windowSeconds: 60 }));
  app.all("/api/*", (c) => c.json({ ok: true }));
  return app;
}

const from = (ip: string) => ({ headers: { "cf-connecting-ip": ip } });

describe("rateLimit middleware", () => {
  it("allows up to the limit per IP, then returns 429", async () => {
    const app = limitedApp(2);
    const ip = freshIp();

    const first = await app.request("/api/circuits", from(ip), testEnv());
    expect(first.status).toBe(200);
    expect(first.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("1");

    expect((await app.request("/api/circuits", from(ip), testEnv())).status).toBe(200);

    const blocked = await app.request("/api/user/delete", from(ip), testEnv());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(await blocked.json()).toMatchObject({
      error: "Too Many Requests",
      limit: 2,
    });
  });

  it("counts each IP separately", async () => {
    const app = limitedApp(1);
    const a = freshIp();
    const b = freshIp();
    expect((await app.request("/api/circuits", from(a), testEnv())).status).toBe(200);
    expect((await app.request("/api/circuits", from(a), testEnv())).status).toBe(429);
    expect((await app.request("/api/circuits", from(b), testEnv())).status).toBe(200);
  });

  it("does not limit the edge-cached public routes", async () => {
    const app = limitedApp(1);
    const ip = freshIp();
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/api/search?q=ldo", from(ip), testEnv());
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    }
    expect(isRateLimitExempt("/api/schematic/foo.kicad_sch")).toBe(true);
    expect(isRateLimitExempt("/api/stats")).toBe(true);
    expect(isRateLimitExempt("/api/tags")).toBe(true);
    expect(isRateLimitExempt("/api/admin/sync-stats")).toBe(false);
    expect(isRateLimitExempt("/api/searchx")).toBe(false);
  });

  it("adds headers to responses with immutable headers (fetch/ASSETS)", async () => {
    const app = new Hono<AppEnv>();
    app.use("/api/*", rateLimit({ maxRequests: 5, windowSeconds: 60 }));
    app.get("/api/*", () => {
      const res = Response.redirect("https://example.com/", 302);
      // Response.redirect() headers are immutable, like fetch() responses
      expect(() => res.headers.set("x", "y")).toThrow();
      return res;
    });
    const res = await app.request("/api/anything", from(freshIp()), testEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  it("prefers cf-connecting-ip over spoofable headers", async () => {
    const app = new Hono();
    app.get("/ip", (c) => c.text(clientIp(c)));
    const res = await app.request("/ip", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "6.6.6.6, 7.7.7.7",
      },
    });
    expect(await res.text()).toBe("1.1.1.1");
    const fallback = await app.request("/ip", {
      headers: { "x-forwarded-for": "6.6.6.6, 7.7.7.7" },
    });
    expect(await fallback.text()).toBe("6.6.6.6");
  });
});
