/**
 * Admin Update Flag API
 *
 * PUT /api/admin/update-flag
 *
 * Allows admins to update flag status (dismiss, resolve, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Use admin client for database operations
    const adminSupabase = createAdminClient();

    // Get request data
    const { flagId, status, adminNotes } = await request.json();

    if (!flagId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: flagId, status" },
        { status: 400 },
      );
    }

    // Validate status
    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Update the flag
    const { error } = await adminSupabase
      .from("circuit_flags")
      .update({
        status,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq("id", flagId);

    if (error) {
      console.error("Error updating flag:", error);
      return NextResponse.json(
        { error: "Failed to update flag", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Flag updated successfully",
    });
  } catch (error: any) {
    console.error("Error in update flag endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint - returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "PUT /api/admin/update-flag",
    description: "Update flag status (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      flagId: "string (UUID)",
      status: "string (pending | reviewed | resolved | dismissed)",
      adminNotes: "string (optional)",
    },
  });
}
