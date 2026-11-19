"use client";

import { AUTH_PROVIDER } from "./config";
import { SupabaseAuthProvider } from "./SupabaseAuthProvider";
import { WorkOSAuthProvider } from "./WorkOSAuthProvider";

/** Mounts the identity provider the site was built for (see config.ts). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return AUTH_PROVIDER === "workos" ? (
    <WorkOSAuthProvider>{children}</WorkOSAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}
