/**
 * Module-level access to the session for code outside React (apiFetch, the
 * Supabase client's accessToken callback, lib helpers).
 *
 * Supabase: read straight from the Supabase browser client's session.
 * WorkOS: the provider registers a bridge once AuthKit has initialised; calls
 * made before that wait for it (briefly), then resolve as signed out.
 */
import type { AppUser } from "./types";
import { AUTH_PROVIDER } from "./config";
import { mapSupabaseUser } from "./supabase-user";

interface AuthBridge {
  getAccessToken: () => Promise<string | null>;
  getUser: () => AppUser | null;
}

let bridge: AuthBridge | null = null;
let waiters: Array<(b: AuthBridge | null) => void> = [];

/** Called by the WorkOS provider when AuthKit is ready (null on unmount). */
export function registerAuthBridge(next: AuthBridge | null) {
  bridge = next;
  if (next) {
    waiters.forEach((resolve) => resolve(next));
    waiters = [];
  }
}

function waitForBridge(timeoutMs = 10_000): Promise<AuthBridge | null> {
  if (bridge || typeof window === "undefined") return Promise.resolve(bridge);
  return new Promise((resolve) => {
    const done = (b: AuthBridge | null) => {
      clearTimeout(timer);
      resolve(b);
    };
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== done);
      resolve(null);
    }, timeoutMs);
    waiters.push(done);
  });
}

/** The current access token (refreshed if needed), or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (AUTH_PROVIDER === "workos") {
    const b = await waitForBridge();
    return b ? b.getAccessToken() : null;
  }
  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<AppUser | null> {
  if (AUTH_PROVIDER === "workos") {
    const b = await waitForBridge();
    return b ? b.getUser() : null;
  }
  const { createClient } = await import("@/lib/supabase/client");
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user ? mapSupabaseUser(user) : null;
}
