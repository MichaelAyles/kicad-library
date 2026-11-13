/**
 * Admin Regenerate Thumbnail API
 *
 * POST /api/admin/regenerate-thumbnail
 *
 * Allows admins to regenerate thumbnails for circuits
 * Uploads to Cloudflare R2 storage
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { uploadThumbnailObject } from "@/lib/r2-schematic";
import {
  recordThumbnailHistory,
  reserveThumbnailVersion,
} from "@/lib/thumbnail-versions";

// Force Node.js runtime for Buffer support
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Error categories for better user feedback
enum ErrorCategory {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  STORAGE = "STORAGE_ERROR",
  DATABASE = "DATABASE_ERROR",
  TIMEOUT = "TIMEOUT_ERROR",
  INTERNAL = "INTERNAL_ERROR",
}

// Helper to create categorized error responses
function createErrorResponse(
  category: ErrorCategory,
  message: string,
  details?: string,
  suggestion?: string,
  statusCode: number = 500,
) {
  return NextResponse.json(
    {
      error: message,
      category,
      details,
      suggestion,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}

// Input validation schema
const RegenerateThumbnailSchema = z.object({
  circuitId: z.string().uuid("Invalid circuit ID format"),
  userId: z.string().uuid("Invalid user ID format"),
  lightThumbBase64: z
    .string()
    .startsWith("data:image/", "Light thumbnail must be a data URL"),
  darkThumbBase64: z
    .string()
    .startsWith("data:image/", "Dark thumbnail must be a data URL"),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return createErrorResponse(
        auth.status === 401
          ? ErrorCategory.AUTHENTICATION
          : ErrorCategory.AUTHORIZATION,
        auth.error,
        undefined,
        auth.status === 401
          ? "Please log in again to get a fresh authentication token"
          : "Contact an administrator if you believe you should have access",
        auth.status,
      );
    }
    const { user } = auth;

    // Use admin client for database operations (bypasses RLS)
    const adminSupabase = createAdminClient();

    // Get request data and validate with Zod
    const body = await request.json();

    // Validate input
    const validationResult = RegenerateThumbnailSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return createErrorResponse(
        ErrorCategory.VALIDATION,
        "Invalid input data",
        JSON.stringify(fieldErrors, null, 2),
        "Ensure circuitId and userId are valid UUIDs, and both thumbnails are base64-encoded data URLs",
        400,
      );
    }

    const { lightThumbBase64, darkThumbBase64 } = validationResult.data;
    // Normalise ids: R2 keys are case-sensitive, Postgres uuids are not
    const circuitId = validationResult.data.circuitId.toLowerCase();
    const userId = validationResult.data.userId.toLowerCase();

    // Verify circuit exists and belongs to the specified user (security check)
    const { data: circuit, error: circuitError } = await adminSupabase
      .from("circuits")
      .select("id, user_id, thumbnail_version")
      .eq("id", circuitId)
      .single();

    if (circuitError || !circuit) {
      return createErrorResponse(
        ErrorCategory.NOT_FOUND,
        "Circuit not found",
        circuitError?.message || `No circuit exists with ID: ${circuitId}`,
        "Verify the circuit ID is correct and the circuit has not been deleted",
        404,
      );
    }

    // Validate ownership (prevent admin from regenerating wrong user's thumbnails)
    if (circuit.user_id !== userId) {
      return createErrorResponse(
        ErrorCategory.VALIDATION,
        "Circuit ownership mismatch",
        `Circuit ${circuitId} belongs to user ${circuit.user_id}, not ${userId}`,
        "Ensure the userId matches the circuit owner",
        400,
      );
    }

    // Reserve a new version with an optimistic lock on the actual DB value
    // (NULL included). It is max(db, R2, history) + 1, so it never reuses a
    // number even after a rollback via "Set as Active".
    let reservation;
    try {
      reservation = await reserveThumbnailVersion(
        circuitId,
        circuit.thumbnail_version,
      );
    } catch (error: any) {
      throw new Error(
        `[STORAGE] Could not allocate a thumbnail version: ${error.message}`,
      );
    }
    if (!reservation.ok) {
      if (reservation.reason === "not_found") {
        return createErrorResponse(
          ErrorCategory.NOT_FOUND,
          "Circuit not found",
          `Circuit ${circuitId} was deleted during regeneration`,
          undefined,
          404,
        );
      }
      return createErrorResponse(
        ErrorCategory.CONFLICT,
        "Version allocation failed",
        reservation.reason === "exhausted"
          ? "Thumbnail version limit reached"
          : "Unable to allocate thumbnail version due to concurrent updates",
        "Please try again in a moment",
        409,
      );
    }
    const version = reservation.version;

    // Upload to R2 under the shared versioned layout:
    // thumbnails/<id>/v<N>-<theme>.png (immutable, long-cached)
    const uploadThumbnail = async (
      base64Data: string,
      theme: "light" | "dark",
    ) => {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64String, "base64");

      try {
        return await uploadThumbnailObject(circuitId, version, theme, buffer);
      } catch (error: any) {
        throw new Error(
          `[STORAGE] Failed to upload ${theme} thumbnail to R2: ${error.message}`,
        );
      }
    };

    // Upload both thumbnails
    const lightUrl = await uploadThumbnail(lightThumbBase64, "light");
    const darkUrl = await uploadThumbnail(darkThumbBase64, "dark");

    // Update circuit record with new thumbnail URLs (version already reserved)
    const { error: updateError } = await adminSupabase
      .from("circuits")
      .update({
        thumbnail_light_url: lightUrl,
        thumbnail_dark_url: darkUrl,
      })
      .eq("id", circuitId);

    if (updateError) {
      console.error("Error updating circuit with thumbnail URLs:", updateError);
      return createErrorResponse(
        ErrorCategory.DATABASE,
        "Failed to update circuit record",
        updateError.message,
        "The thumbnails were uploaded but could not be linked to the circuit. Please try regenerating again.",
        500,
      );
    }

    // History is an audit trail; failures here don't fail the request
    const historyError = await recordThumbnailHistory({
      circuitId,
      version,
      lightUrl,
      darkUrl,
      regeneratedBy: user.id,
      notes: "Admin regeneration",
    });
    if (historyError) {
      console.warn(
        "Thumbnail history update failed (non-critical):",
        historyError,
      );
    }

    return NextResponse.json({
      success: true,
      lightUrl,
      darkUrl,
      version,
      message: `Thumbnails uploaded successfully (v${version})`,
    });
  } catch (error: any) {
    console.error("Error in regenerate thumbnail endpoint:", error);
    console.error("Error stack:", error.stack);

    // Categorize errors based on message patterns
    let category = ErrorCategory.INTERNAL;
    let suggestion =
      "Please try again or contact support if the problem persists";

    if (error.message?.includes("[STORAGE]")) {
      category = ErrorCategory.STORAGE;
      suggestion = "Check storage quota and permissions, then try again";
    } else if (
      error.message?.includes("timeout") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      category = ErrorCategory.TIMEOUT;
      suggestion =
        "The operation took too long. Try reducing the image size or try again later";
    } else if (error.message?.includes("JSON")) {
      category = ErrorCategory.VALIDATION;
      suggestion = "Ensure the request body is valid JSON with required fields";
    }

    return createErrorResponse(
      category,
      "Thumbnail regeneration failed",
      error.message,
      suggestion,
      500,
    );
  }
}

/**
 * GET endpoint - returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/admin/regenerate-thumbnail",
    description: "Regenerate thumbnails for a circuit (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      circuitId: "string (UUID)",
      userId: "string (UUID) - owner of the circuit",
      lightThumbBase64: "string (base64 encoded PNG)",
      darkThumbBase64: "string (base64 encoded PNG)",
    },
  });
}
