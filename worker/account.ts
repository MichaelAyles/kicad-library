import type { AccountDeletionDeps } from "../src/lib/account-deletion-core";
import type { Env } from "./env";
import { createCircuitStorage } from "./r2";
import { createAdminClient } from "./supabase";
import { createWorkosClient } from "./workos";

/** Everything deleteUserAccountWith() needs, wired to this worker's env. */
export function accountDeletionDeps(env: Env): AccountDeletionDeps {
  const storage = createCircuitStorage(env);
  const workos = env.WORKOS_API_KEY
    ? createWorkosClient(env.WORKOS_API_KEY)
    : null;
  return {
    admin: createAdminClient(env),
    deleteCircuitFiles: (id) => storage.deleteCircuitFiles(id),
    deleteIdentity: workos
      ? async (userId) => {
          const workosUser = await workos.getUserByExternalId(userId);
          if (workosUser) await workos.deleteUser(workosUser.id);
        }
      : undefined,
  };
}
