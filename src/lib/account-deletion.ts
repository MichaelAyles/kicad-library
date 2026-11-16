/**
 * Server-only: permanently delete a user account (Next routes).
 *
 * The logic lives in account-deletion-core.ts; this binds it to the
 * service-role client and the AWS SDK R2 client, and drops ISR pages.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCircuitFiles } from "@/lib/r2-schematic";
import { deleteUserAccountWith } from "@/lib/account-deletion-core";

export async function deleteUserAccount(
  userId: string,
): Promise<{ circuitCount: number }> {
  const { circuitCount, slugs } = await deleteUserAccountWith(
    { admin: createAdminClient(), deleteCircuitFiles },
    userId,
  );

  // Drop the ISR-cached pages of the deleted circuits. Must run inside a
  // route handler or server action (both callers are route handlers).
  for (const slug of slugs) {
    revalidatePath(`/circuit/${slug}`);
  }

  return { circuitCount };
}
