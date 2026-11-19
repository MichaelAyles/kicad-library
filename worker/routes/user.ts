/** Port of src/app/api/user/delete/route.ts. */

import { Hono } from "hono";
import { deleteUserAccountWith } from "../../src/lib/account-deletion-core";
import type { AppEnv } from "../env";
import { bearerToken, getRequestUser, verifyWorkosClaims } from "../auth";
import { accountDeletionDeps } from "../account";
import { createAdminClient } from "../supabase";
import { requestRebuild } from "../rebuild";
import {
  createWorkosClient,
  profileIdForWorkosUser,
  WorkosApiError,
} from "../workos";

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

    await deleteUserAccountWith(accountDeletionDeps(c.env), user.id);

    // Remove the static pages of the user's circuits
    requestRebuild(c, "account deleted");

    return c.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/user/delete:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

/**
 * POST /api/me
 * Link a WorkOS user to their CircuitSnips profile, creating the profile on
 * their first sign-in.
 *
 * Imported users already carry their profile id as the WorkOS external_id
 * (the `uid` claim). A user who signed up through WorkOS has none: this
 * creates a profile with a deterministic id derived from their WorkOS id
 * (retries land on the same profile) and stores it as their external_id. The
 * client then refreshes its access token to pick up the `uid` claim.
 *
 * Response: { id } (the profile id).
 */
userRoutes.post("/api/me", async (c) => {
  const token = bearerToken(c.req.header("Authorization"));
  const claims = token ? await verifyWorkosClaims(token, c.env) : null;
  if (!claims || typeof claims.sub !== "string") {
    return c.json({ error: "Unauthorized - Please sign in" }, 401);
  }
  if (!c.env.WORKOS_API_KEY) {
    console.error("POST /api/me: WORKOS_API_KEY is not set");
    return c.json({ error: "Sign-up is not available" }, 503);
  }

  try {
    const workos = createWorkosClient(c.env.WORKOS_API_KEY);
    const workosUser = await workos.getUser(claims.sub);
    if (!workosUser) {
      return c.json({ error: "Unauthorized - Please sign in" }, 401);
    }

    let profileId = workosUser.external_id;
    if (!profileId) {
      profileId = await profileIdForWorkosUser(workosUser.id);
      const emailName = workosUser.email.split("@")[0];
      const { error } = await createAdminClient(c.env).rpc("ensure_profile", {
        p_id: profileId,
        p_username: emailName,
        p_avatar_url: workosUser.profile_picture_url,
        p_github_url: null,
      });
      if (error) {
        console.error("POST /api/me: ensure_profile failed:", error.message);
        return c.json({ error: "Failed to create profile" }, 500);
      }
      await workos.setExternalId(workosUser.id, profileId);
    }

    return c.json({ id: profileId });
  } catch (error) {
    console.error(
      "Error in POST /api/me:",
      error instanceof WorkosApiError ? error.message : error,
    );
    return c.json({ error: "Failed to link account" }, 500);
  }
});

export default userRoutes;
