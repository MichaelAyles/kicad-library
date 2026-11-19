"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthContext } from "./context";
import { mapSupabaseUser } from "./supabase-user";
import type { AppUser, AuthContextValue } from "./types";

function siteOrigin() {
  return typeof window !== "undefined"
    ? window.location.origin
    : "https://www.circuitsnips.com";
}

/** Supabase Auth in the browser (PKCE, session in cookies via @supabase/ssr). */
export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(data.user ? mapSupabaseUser(data.user) : null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Auth error");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  // Run an auth action, surfacing its error in context and rethrowing
  const run = useCallback(
    async (fallback: string, action: () => Promise<{ error: unknown }>) => {
      setError(null);
      try {
        const { error } = await action();
        if (error) throw error;
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
        throw err;
      }
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      error,
      isAuthenticated: !!user,
      // The /login and /signup pages hold the Supabase forms
      signIn: async () => {
        router.push("/login");
      },
      signUp: async () => {
        router.push("/signup");
      },
      signOut: async () => {
        await run("Sign out failed", () => supabase.auth.signOut());
        setUser(null);
        router.push("/");
      },
      signInWithGitHub: () =>
        run("GitHub sign in failed", () =>
          supabase.auth.signInWithOAuth({
            provider: "github",
            options: { redirectTo: `${siteOrigin()}/auth/callback` },
          }),
        ),
      signInWithEmail: (email, password) =>
        run("Email sign in failed", () =>
          supabase.auth.signInWithPassword({ email, password }),
        ),
      signUpWithEmail: (email, password, username) =>
        run("Email sign up failed", () =>
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${siteOrigin()}/auth/callback`,
              data: { username: username || email.split("@")[0] },
            },
          }),
        ),
      resetPassword: (email) =>
        run("Password reset failed", () =>
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteOrigin()}/auth/reset-password`,
          }),
        ),
      updatePassword: (password) =>
        run("Password update failed", () =>
          supabase.auth.updateUser({ password }),
        ),
    }),
    [user, isLoading, error, router, run, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Wait for the Supabase browser client to finish initialising (which
 * completes a PKCE `?code=` exchange on /auth/callback) and report whether a
 * session exists.
 */
export async function waitForSupabaseSession(): Promise<{
  signedIn: boolean;
  error: string | null;
}> {
  const { data, error } = await createClient().auth.getSession();
  return { signedIn: !!data.session, error: error?.message ?? null };
}
