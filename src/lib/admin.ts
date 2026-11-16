/**
 * Admin checks for the browser (UI only: the API and RLS enforce access).
 *
 * AppUser.isAdmin comes from a value only the server can set: Supabase
 * app_metadata.role, or the WorkOS `app_role` claim. Never user_metadata,
 * which users can edit themselves.
 */

import { getCurrentUser, type AppUser } from "@/lib/auth";

/** Whether the user is an admin. Async for existing callers. */
export async function isAdmin(user?: AppUser | null): Promise<boolean> {
  return user?.isAdmin === true;
}

/** Whether the signed-in user is an admin. */
export async function getCurrentUserIsAdmin(): Promise<boolean> {
  return isAdmin(await getCurrentUser());
}
