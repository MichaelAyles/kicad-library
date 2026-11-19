"use client";

import { useContext } from "react";
import { AuthContext } from "@/lib/auth/context";
import type { AuthContextValue } from "@/lib/auth/types";

/**
 * The signed-in user and auth actions, from whichever provider the site was
 * built for (src/lib/auth). Needs <AuthProvider> (mounted in the root layout).
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return value;
}

/**
 * useAuth() for the Supabase-only pages (email/password forms, GitHub button,
 * password reset), which the WorkOS build replaces with the hosted AuthKit
 * pages. Throws if the site was built for WorkOS.
 */
export function useSupabaseAuth(): Required<AuthContextValue> {
  const value = useAuth();
  if (
    !value.signInWithGitHub ||
    !value.signInWithEmail ||
    !value.signUpWithEmail ||
    !value.resetPassword ||
    !value.updatePassword
  ) {
    throw new Error("useSupabaseAuth() needs the Supabase Auth build");
  }
  return value as Required<AuthContextValue>;
}
