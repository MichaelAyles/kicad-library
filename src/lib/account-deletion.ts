/**
 * Server-only: permanently delete a user account.
 *
 * Deleting the auth.users row cascades (via FK constraints) to profiles,
 * circuits, favorites, comments, comment likes, etc. R2 objects aren't covered
 * by the cascade, so they're removed separately on a best-effort basis.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCircuitFiles } from "@/lib/r2-schematic";

export async function deleteUserAccount(
  userId: string,
): Promise<{ circuitCount: number }> {
  const supabase = createAdminClient();

  // Collect circuit IDs before the cascade removes them
  const { data: circuits, error: listError } = await supabase
    .from("circuits")
    .select("id")
    .eq("user_id", userId);

  if (listError) {
    throw new Error(`Failed to list user circuits: ${listError.message}`);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
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

  return { circuitCount: circuitIds.length };
}
