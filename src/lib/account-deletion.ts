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

  const circuitIds = (circuits ?? []).map((c) => c.id as string);
  const results = await Promise.allSettled(
    circuitIds.map((id) => deleteCircuitFiles(id)),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(
      `Account ${userId} deleted, but R2 cleanup failed for ${failed}/${circuitIds.length} circuits`,
    );
  }

  return { circuitCount: circuitIds.length };
}
