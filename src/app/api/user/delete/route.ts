import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteUserAccount } from "@/lib/account-deletion";

/**
 * DELETE /api/user/delete
 * Delete the signed-in user's account and all associated data.
 *
 * Removing the auth user cascades to profile, circuits, favorites, comments,
 * comment likes and copies. R2 schematics/thumbnails are removed as well.
 */
export async function DELETE() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 },
      );
    }

    await deleteUserAccount(user.id);

    // Clear the session cookies; the user no longer exists
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/user/delete:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
