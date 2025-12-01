import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

// R2 client singleton
function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

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
    // Get the Authorization header with bearer token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return createErrorResponse(
        ErrorCategory.AUTHENTICATION,
        "No authentication token provided",
        "The Authorization header is missing or invalid",
        "Please include a valid Bearer token in the Authorization header",
        401,
      );
    }

    // Create a client with the anon key to verify the token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createAnonClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the token by getting the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(
        ErrorCategory.AUTHENTICATION,
        "Invalid authentication token",
        authError?.message,
        "Please log in again to get a fresh authentication token",
        401,
      );
    }

    // Check if user has admin role using centralized helper
    const adminStatus = await isAdmin(user);
    if (!adminStatus) {
      return createErrorResponse(
        ErrorCategory.AUTHORIZATION,
        "Admin access required",
        "This endpoint is restricted to administrators only",
        "Contact an administrator if you believe you should have access",
        403,
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
      const r2 = getR2Client();
      const bucketName = process.env.R2_BUCKET_NAME!;

      // Build set of circuit IDs for quick lookup
      const circuitIdSet = new Set(circuits.map((c) => c.id));

      // List all thumbnail files in R2
      console.log("Listing all thumbnail files in R2...");
      let continuationToken: string | undefined;
      const keysToDelete: string[] = [];

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: "thumbnails/",
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const listResult = await r2.send(listCommand);

        if (listResult.Contents) {
          for (const obj of listResult.Contents) {
            if (!obj.Key) continue;
            // Extract circuit ID from filename (format: thumbnails/circuitId-v#-theme.png)
            const match = obj.Key.match(/^thumbnails\/([a-f0-9-]+)-v\d+-/);
            if (match && circuitIdSet.has(match[1])) {
              keysToDelete.push(obj.Key);
            }
          }
        }

        continuationToken = listResult.IsTruncated
          ? listResult.NextContinuationToken
          : undefined;
      } while (continuationToken);

      console.log(
        `Found ${keysToDelete.length} thumbnail files to delete in R2`,
      );

      if (keysToDelete.length > 0) {
        // Delete in batches of 1000 (R2/S3 limit)
        const batchSize = 1000;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);

          const deleteCommand = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: batch.map((key) => ({ Key: key })),
              Quiet: true,
            },
          });

          try {
            const deleteResult = await r2.send(deleteCommand);
            const errorsInBatch = deleteResult.Errors?.length || 0;
            deletedFiles += batch.length - errorsInBatch;
            failedFiles += errorsInBatch;

            if (errorsInBatch > 0) {
              console.error(
                `Errors in batch ${i / batchSize + 1}:`,
                deleteResult.Errors,
              );
            }
          } catch (error) {
            console.error(`Error deleting batch ${i / batchSize + 1}:`, error);
            failedFiles += batch.length;
          }
        }
      }
    } catch (error) {
      console.error("Error processing R2 files:", error);
      // Continue to database update even if file deletion fails
    }

    // Delete all thumbnail history records for these circuits
    const circuitIds = circuits.map((c) => c.id);

    try {
      const { error: historyDeleteError } = await adminClient
        .from("thumbnail_history")
        .delete()
        .in("circuit_id", circuitIds);

      if (historyDeleteError) {
        console.warn(
          "Error deleting thumbnail history (non-critical):",
          historyDeleteError,
        );
      } else {
        console.log("Deleted thumbnail history for all circuits");
      }
    } catch (error) {
      console.warn("Thumbnail history deletion skipped (table may not exist)");
    }

    // Update database to set thumbnail URLs to null and reset version to 0
    const { error: updateError } = await adminClient
      .from("circuits")
      .update({
        thumbnail_light_url: null,
        thumbnail_dark_url: null,
        thumbnail_version: 0,
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
