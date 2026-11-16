/**
 * Which identity provider the site is built for. Chosen at build time:
 * NEXT_PUBLIC_AUTH_PROVIDER=workos switches to WorkOS AuthKit; anything else
 * (including unset) keeps Supabase Auth. Rolling back is a rebuild.
 */
export type AuthProviderName = "supabase" | "workos";

export const AUTH_PROVIDER: AuthProviderName =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER === "workos" ? "workos" : "supabase";

export const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID ?? "";

/** Custom AuthKit domain (e.g. auth.circuitsnips.com); unset uses WorkOS's. */
export const WORKOS_API_HOSTNAME =
  process.env.NEXT_PUBLIC_WORKOS_API_HOSTNAME || undefined;
