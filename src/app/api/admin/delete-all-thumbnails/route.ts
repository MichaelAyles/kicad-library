import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import {
  deleteKeys,
  listKeys,
  parseThumbnailKey,
} from "@/lib/r2-schematic";

// Increase timeout for large operations
export const maxDuration = 60; // 60 seconds max (requires Vercel Pro)
export const dynamic = "force-dynamic";

// Error categories for better user feedback
enum ErrorCategory {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
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

/**
 * DELETE /api/admin/delete-all-thumbnails
 *
 * Admin endpoint to delete all thumbnails from circuitsnips-importer circuits
 * - Deletes thumbnail files from storage
 * - Sets thumbnail_light_url and thumbnail_dark_url to null in database
 */
export async function DELETE(request: NextRequest) {
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

    // Use admin client for operations
    const adminClient = createAdminClient();

    // Get the circuitsnips-importer user ID
    const { data: importerUser, error: importerError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", "circuitsnips-importer")
      .single();

    if (importerError || !importerUser) {
      return createErrorResponse(
        ErrorCategory.NOT_FOUND,
        "Importer user not found",
        "The circuitsnips-importer user does not exist in the database",
        "Ensure the importer user account has been created",
        404,
      );
    }

    // Fetch ALL circuits from circuitsnips-importer (pagination to handle large datasets)
    let allCircuits: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: circuits, error: fetchError } = await adminClient
        .from("circuits")
        .select("id, user_id, thumbnail_light_url, thumbnail_dark_url")
        .eq("user_id", importerUser.id)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error("Error fetching circuits:", fetchError);
        return createErrorResponse(
          ErrorCategory.DATABASE,
          "Failed to fetch circuits",
          fetchError.message,
          "Database query failed. Please try again",
          500,
        );
      }

      if (!circuits || circuits.length === 0) {
        hasMore = false;
      } else {
        allCircuits = allCircuits.concat(circuits);
        hasMore = circuits.length === pageSize;
        page++;
      }
    }

    console.log(
      `Found ${allCircuits.length} total circuits for circuitsnips-importer`,
    );

    if (allCircuits.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No circuits found for circuitsnips-importer",
        deletedCount: 0,
      });
    }

    const circuits = allCircuits;

    // Delete ALL thumbnail files for these circuits from R2
    let deletedFiles = 0;
    let failedFiles = 0;

    try {
      // Build set of circuit IDs for quick lookup
      const circuitIdSet = new Set(
        circuits.map((c) => String(c.id).toLowerCase()),
      );

      // List all thumbnail files in R2. parseThumbnailKey matches every
      // layout (thumbnails/<id>/v<N>-<theme>.png, thumbnails/<id>/<theme>.png,
      // thumbnails/<id>-v<N>-<theme>.png) and returns lowercase ids.
      console.log("Listing all thumbnail files in R2...");
      const keysToDelete = (await listKeys("thumbnails/")).filter((key) => {
        const parsed = parseThumbnailKey(key);
        return parsed !== null && circuitIdSet.has(parsed.circuitId);
      });

      console.log(
        `Found ${keysToDelete.length} thumbnail files to delete in R2`,
      );

      // Delete in batches of 1000 (R2/S3 limit)
      const deleteResult = await deleteKeys(keysToDelete);
      deletedFiles = deleteResult.deleted;
      failedFiles = deleteResult.failed;
    } catch (error) {
      console.error("Error processing R2 files:", error);
      // Continue to database update even if file deletion fails
    }

    // Delete all thumbnail history records for these circuits. The ids go in
    // the request URL, so chunk them: ~4,300 ids in one `.in()` overflows
    // the URL length limit and the whole delete fails.
    const circuitIds = circuits.map((c) => c.id);
    const HISTORY_CHUNK_SIZE = 100;
    let historyChunksFailed = 0;
    for (let i = 0; i < circuitIds.length; i += HISTORY_CHUNK_SIZE) {
      const { error: historyDeleteError } = await adminClient
        .from("thumbnail_history")
        .delete()
        .in("circuit_id", circuitIds.slice(i, i + HISTORY_CHUNK_SIZE));
      if (historyDeleteError) {
        historyChunksFailed++;
        console.warn(
          "Error deleting thumbnail history chunk (non-critical):",
          historyDeleteError,
        );
      }
    }

    // Clear the thumbnail URLs. thumbnail_version is deliberately kept:
    // versioned keys are cached as immutable, so the next regeneration must
    // continue from this number instead of reusing v1, v2, ... whose old
    // images may still be in CDN and browser caches.
    const { error: updateError } = await adminClient
      .from("circuits")
      .update({
        thumbnail_light_url: null,
        thumbnail_dark_url: null,
      })
      .eq("user_id", importerUser.id);

    if (updateError) {
      console.error("Error updating database:", updateError);
      return createErrorResponse(
        ErrorCategory.DATABASE,
        "Failed to update circuit records",
        updateError.message,
        "Storage files were deleted but database update failed. Please try deleting again.",
        500,
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted all thumbnails from ${circuits.length} @circuitsnips-importer circuits`,
      circuitsUpdated: circuits.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles,
      historyChunksFailed,
    });
  } catch (error: any) {
    console.error("Error in delete-all-thumbnails:", error);

    // Categorize errors
    let category = ErrorCategory.INTERNAL;
    let suggestion =
      "Please try again or contact support if the problem persists";

    if (
      error.message?.includes("timeout") ||
      error.message?.includes("ETIMEDOUT")
    ) {
      category = ErrorCategory.TIMEOUT;
      suggestion =
        "The operation took too long. The database may be under heavy load. Try again later.";
    } else if (error.message?.includes("storage")) {
      category = ErrorCategory.STORAGE;
      suggestion =
        "Storage operation failed. Check storage quota and permissions.";
    }

    return createErrorResponse(
      category,
      "Bulk thumbnail deletion failed",
      error.message || "Unknown error",
      suggestion,
      500,
    );
  }
}
