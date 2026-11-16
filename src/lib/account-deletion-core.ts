/**
 * Server-only: permanently delete a user account (storage-agnostic).
 *
 * The profile is the root of everything a user owns: deleting it cascades
 * (via FK constraints) to circuits, favorites, comments, comment likes, etc.
 * Users from before the WorkOS move also have an auth.users row, which is
 * deleted too so the old login can't be used again. Users who signed up
 * through WorkOS have none. R2 objects and the WorkOS user aren't covered by
 * the cascade, so they're removed separately on a best-effort basis.
 *
 * Clients are injected so the same logic runs in the Next routes
 * (account-deletion.ts) and the API worker.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccountDeletionDeps {
  /** Service-role client. */
  admin: SupabaseClient;
  /** Remove a circuit's R2 objects; rejects if any could not be deleted. */
  deleteCircuitFiles: (circuitId: string) => Promise<void>;
  /** Remove the user from an external identity provider (WorkOS), if any. */
  deleteIdentity?: (userId: string) => Promise<void>;
}

export async function deleteUserAccountWith(
  { admin, deleteCircuitFiles, deleteIdentity }: AccountDeletionDeps,
  userId: string,
): Promise<{ circuitCount: number; slugs: string[] }> {
  // Collect circuit IDs and slugs before the cascade removes them
  const { data: circuits, error: listError } = await admin
    .from("circuits")
    .select("id, slug")
    .eq("user_id", userId);

  if (listError) {
    throw new Error(`Failed to list user circuits: ${listError.message}`);
  }

  // Supabase Auth login, if the user has one. Before the identity migration
  // this also cascades to the profile; after it, a trigger deletes the profile.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError && authError.status !== 404) {
    throw new Error(`Failed to delete auth user: ${authError.message}`);
  }

  // The profile and, through the cascades, everything the user owns. Usually
  // already gone after the step above; required for WorkOS-only users.
  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileError) {
    throw new Error(`Failed to delete profile: ${profileError.message}`);
  }

  if (deleteIdentity) {
    try {
      await deleteIdentity(userId);
    } catch (error) {
      console.error(`Account ${userId} deleted, but identity cleanup failed:`, error);
    }
  }

  // A few circuits at a time: each one is several R2 list/delete calls, and
  // an account can own thousands of circuits
  const circuitIds = (circuits ?? []).map((c) => c.id as string);
  const CONCURRENCY = 8;
  let failed = 0;
  for (let i = 0; i < circuitIds.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      circuitIds.slice(i, i + CONCURRENCY).map((id) => deleteCircuitFiles(id)),
    );
    failed += results.filter((r) => r.status === "rejected").length;
  }
  if (failed > 0) {
    console.error(
      `Account ${userId} deleted, but R2 cleanup failed for ${failed}/${circuitIds.length} circuits`,
    );
  }

  return {
    circuitCount: circuitIds.length,
    slugs: (circuits ?? []).map((c) => c.slug as string),
  };
}
