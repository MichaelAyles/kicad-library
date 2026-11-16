/**
 * Bindings, vars and secrets of the API worker (wrangler.worker.jsonc).
 *
 * Vars live in the wrangler config; secrets are set with
 * `wrangler secret put <NAME> -c wrangler.worker.jsonc` (or `.dev.vars`
 * locally). Code should read them from `c.env`, not `process.env`.
 */
export interface Env {
  /** Static export (`out/`), for pages the asset router didn't match. */
  ASSETS: Fetcher;
  /** Public bucket `circuitsnips`: schematics/ and thumbnails/. */
  SCHEMATICS_BUCKET: R2Bucket;

  /** Public origin of SCHEMATICS_BUCKET, without a trailing slash (var). */
  R2_PUBLIC_URL: string;
  /** https://<ref>.supabase.co (var). */
  SUPABASE_URL: string;
  /** Secret (public in practice, but kept with the others). */
  SUPABASE_ANON_KEY: string;
  /** Secret. Bypasses RLS: admin routes and server-side writes only. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Secret. Bearer key accepted by /api/admin/batch-import (scripts). */
  ADMIN_API_KEY?: string;
  /** Owner of batch-imported circuits (profiles.id of the importer bot). */
  BOT_USER_ID?: string;

  /**
   * WorkOS AuthKit client id. When set, access tokens issued by WorkOS are
   * accepted alongside Supabase Auth tokens.
   */
  WORKOS_CLIENT_ID?: string;
  /**
   * Optional expected `iss` of WorkOS access tokens (e.g. a custom auth
   * domain). When set, WorkOS tokens with any other issuer are rejected.
   */
  WORKOS_ISSUER?: string;
}

/** The authenticated caller, whichever identity provider issued the token. */
export interface RequestUser {
  /** Supabase user uuid (auth.users.id / profiles.id). */
  id: string;
  isAdmin: boolean;
  /** The bearer token the request was authenticated with. */
  token: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** Memoised result of getRequestUser() for this request. */
    requestUser?: Promise<RequestUser | null>;
  };
}
