"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthKitProvider,
  getClaims,
  useAuth as useAuthKit,
  type User as WorkOSUser,
} from "@workos-inc/authkit-react";
import { AuthContext } from "./context";
import { WORKOS_API_HOSTNAME, WORKOS_CLIENT_ID } from "./config";
import { safeReturnUrl } from "./return-to";
import { registerAuthBridge } from "./session";
import type { AppUser, AuthContextValue, SignInOptions } from "./types";

/** Custom claims from the WorkOS JWT template (see docs/workos-migration.md) */
interface CircuitSnipsClaims {
  /** Our Supabase uuid (WorkOS user.external_id) */
  uid?: unknown;
  /** "admin" for admins (WorkOS user metadata, set server-side only) */
  app_role?: unknown;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function mapWorkOSUser(user: WorkOSUser, claims: CircuitSnipsClaims): AppUser {
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
  return {
    id: claims.uid as string,
    email: user.email ?? null,
    name,
    username: null,
    avatarUrl: user.profilePictureUrl ?? null,
    isAdmin: claims.app_role === "admin",
  };
}

function isLocalhost() {
  return (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  );
}

/**
 * WorkOS AuthKit in the browser. The hosted AuthKit pages handle passwords,
 * GitHub, Google and password resets; the refresh token lives in an HttpOnly
 * cookie on the AuthKit domain (a custom domain in production, devMode on
 * localhost only).
 */
export function WorkOSAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  return (
    <AuthKitProvider
      clientId={WORKOS_CLIENT_ID}
      apiHostname={WORKOS_API_HOSTNAME}
      redirectUri={redirectUri}
      devMode={isLocalhost()}
      onRedirectCallback={({ state }) => {
        // `state` is untrusted (plain text in the URL): only same-origin
        router.replace(safeReturnUrl(state?.returnTo) ?? "/");
      }}
    >
      <WorkOSSession>{children}</WorkOSSession>
    </AuthKitProvider>
  );
}

function WorkOSSession({ children }: { children: React.ReactNode }) {
  const kit = useAuthKit();
  const { isLoading: kitLoading, user: kitUser, getAccessToken } = kit;

  const [user, setUser] = useState<AppUser | null>(null);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<AppUser | null>(null);
  // WorkOS user ids we've already asked the API to provision
  const provisioned = useRef(new Set<string>());

  useEffect(() => {
    if (kitLoading) return;
    let cancelled = false;

    const finish = (next: AppUser | null, message: string | null) => {
      if (cancelled) return;
      userRef.current = next;
      setUser(next);
      setError(message);
      setResolving(false);
      // Non-React callers (apiFetch, the Supabase client) read through this
      registerAuthBridge({
        getAccessToken: async () => {
          if (!userRef.current) return null;
          try {
            return await getAccessToken();
          } catch {
            return null;
          }
        },
        getUser: () => userRef.current,
      });
    };

    (async () => {
      setResolving(true);
      if (!kitUser) return finish(null, null);
      try {
        let token = await getAccessToken();
        let claims = getClaims<CircuitSnipsClaims>(token);

        // A brand-new WorkOS user has no uid yet: ask the API to create the
        // profile and set the WorkOS external_id, then refresh the token so
        // the template picks it up. Once per user per page load.
        if (!isUuid(claims.uid) && !provisioned.current.has(kitUser.id)) {
          provisioned.current.add(kitUser.id);
          const res = await fetch("/api/me", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(`Account setup failed (${res.status})`);
          token = await getAccessToken({ forceRefresh: true });
          claims = getClaims<CircuitSnipsClaims>(token);
        }

        if (!isUuid(claims.uid)) {
          throw new Error(
            "Your account couldn't be set up. Please try signing in again.",
          );
        }
        finish(mapWorkOSUser(kitUser, claims), null);
      } catch (err) {
        console.error("Sign-in setup failed:", err);
        finish(null, err instanceof Error ? err.message : "Sign-in failed");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-resolve when AuthKit finishes loading or the signed-in user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitLoading, kitUser?.id]);

  useEffect(() => () => registerAuthBridge(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: kitLoading || resolving,
      error,
      isAuthenticated: !!user,
      signIn: (opts?: SignInOptions) =>
        kit.signIn(
          opts?.returnTo ? { state: { returnTo: opts.returnTo } } : undefined,
        ),
      signUp: (opts?: SignInOptions) =>
        kit.signUp(
          opts?.returnTo ? { state: { returnTo: opts.returnTo } } : undefined,
        ),
      signOut: async () => {
        userRef.current = null;
        setUser(null);
        // Ends the AuthKit session, then returns to the homepage (which must
        // be an allowed logout URI in the WorkOS environment)
        kit.signOut({ returnTo: window.location.origin });
      },
    }),
    [user, kitLoading, resolving, error, kit],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
