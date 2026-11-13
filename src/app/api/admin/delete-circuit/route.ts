/**
 * Admin Delete Circuit API
 *
 * DELETE /api/admin/delete-circuit
 *
 * Allows admins to delete circuits
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, requireAdmin } from "@/lib/api-auth";
import { deleteCircuitFiles } from "@/lib/r2-schematic";

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Use admin client for deletion
    const adminSupabase = createAdminClient();

    // Get circuit ID from request body
    const { circuitId } = await request.json();

    if (!isUuid(circuitId)) {
      return NextResponse.json(
        { error: "Missing or invalid circuitId in request body" },
        { status: 400 },
      );
    }

    // Delete the circuit (cascades will handle related data)
    const { error } = await adminSupabase
      .from("circuits")
      .delete()
      .eq("id", circuitId);

    if (error) {
      console.error("Error deleting circuit:", error);
      return NextResponse.json(
        { error: "Failed to delete circuit", details: error.message },
        { status: 500 },
      );
    }

    // Remove the circuit's public files from R2 (best effort)
    try {
      await deleteCircuitFiles(circuitId);
    } catch (r2Error) {
      console.error("Circuit deleted but R2 cleanup failed:", r2Error);
    }

    return NextResponse.json({
      success: true,
      message: "Circuit deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete circuit endpoint:", error);
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
    endpoint: "DELETE /api/admin/delete-circuit",
    description: "Delete a circuit (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      circuitId: "string (UUID)",
    },
  });
}
