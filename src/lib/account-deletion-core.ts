/**
 * Server-only: permanently delete a user account (storage-agnostic).
 *
 * Deleting the auth.users row cascades (via FK constraints) to profiles,
 * circuits, favorites, comments, comment likes, etc. R2 objects aren't covered
 * by the cascade, so they're removed separately on a best-effort basis.
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
}

export async function deleteUserAccountWith(
  { admin, deleteCircuitFiles }: AccountDeletionDeps,
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

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw new Error(`Failed to delete user: ${deleteError.message}`);
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
