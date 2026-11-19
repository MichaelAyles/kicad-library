import type { User } from "@supabase/supabase-js";
import type { AppUser } from "./types";

/**
 * Supabase user -> AppUser. Admin comes from app_metadata, which only the
 * service role can write; user_metadata is user-editable and is used for
 * display fields only.
 */
export function mapSupabaseUser(user: User): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    name: (meta.full_name || meta.name || null) as string | null,
    // GitHub login (set by the GitHub provider only)
    username: (meta.user_name || meta.preferred_username || null) as
      | string
      | null,
    avatarUrl: (meta.avatar_url || null) as string | null,
    isAdmin: user.app_metadata?.role === "admin",
  };
}
