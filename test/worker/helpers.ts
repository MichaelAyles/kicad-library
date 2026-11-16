/**
 * Test doubles for the API worker: a chainable fake Supabase client and a
 * minimal Env. No network access.
 */

import { vi } from "vitest";
import type { Env } from "../../worker/env";

export type QueryResult = { data: unknown; error: unknown };
/** Decides the result of a query from its table and the methods called. */
export type Resolver = (table: string, ops: string[]) => QueryResult;

/**
 * A fake SupabaseClient: `from(table)` returns a builder where every method
 * chains, and awaiting it (or calling single/maybeSingle) yields
 * `resolve(table, ops)`.
 */
export function fakeSupabase(
  resolve: Resolver = () => ({ data: null, error: null }),
  auth: unknown = {
    getUser: async () => ({ data: { user: null }, error: { message: "no" } }),
  },
) {
  return {
    from(table: string) {
      const ops: string[] = [];
      const builder: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              const result = resolve(table, ops);
              return (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
                Promise.resolve(result).then(onOk, onErr);
            }
            return () => {
              ops.push(String(prop));
              if (prop === "single" || prop === "maybeSingle") {
                return Promise.resolve(resolve(table, ops));
              }
              return builder;
            };
          },
        },
      );
      return builder;
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth,
  };
}

export function fakeBucket() {
  return {
    put: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    head: vi.fn(async () => null),
    list: vi.fn(async () => ({ objects: [], truncated: false })),
  };
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response("asset fallback", { status: 404 })),
    } as unknown as Fetcher,
    SCHEMATICS_BUCKET: fakeBucket() as unknown as R2Bucket,
    R2_PUBLIC_URL: "https://pub.example.r2.dev",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    ...overrides,
  };
}

let ipCounter = 0;
/** A fresh client IP per call, so tests don't share rate-limit counters. */
export function freshIp(): string {
  ipCounter++;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}
