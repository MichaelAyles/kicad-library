/** Port of src/app/api/user/delete/route.ts. */

import { Hono } from "hono";
import { deleteUserAccountWith } from "../../src/lib/account-deletion-core";
import type { AppEnv } from "../env";
import { getRequestUser } from "../auth";
import { createCircuitStorage } from "../r2";
import { createAdminClient } from "../supabase";

const userRoutes = new Hono<AppEnv>();

/**
 * DELETE /api/user/delete
 * Delete the signed-in user's account and all associated data. Removing the
 * auth user cascades to profile, circuits, favorites, comments, likes and
 * copies; R2 schematics/thumbnails are removed as well. The client should
 * sign out afterwards (there are no session cookies to clear here).
 */
userRoutes.delete("/api/user/delete", async (c) => {
  try {
    const user = await getRequestUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized - Please sign in" }, 401);
    }

    const storage = createCircuitStorage(c.env);
    await deleteUserAccountWith(
      {
        admin: createAdminClient(c.env),
        deleteCircuitFiles: (id) => storage.deleteCircuitFiles(id),
      },
      user.id,
    );

    return c.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/user/delete:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

export default userRoutes;
