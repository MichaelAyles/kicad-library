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
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createAnonClient } from "@supabase/supabase-js";
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
    // This checks app_metadata (server-controlled), user_metadata (fallback), and database
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

    // Use admin client for storage operations (bypasses RLS)
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

    const { circuitId, userId, lightThumbBase64, darkThumbBase64 } =
      validationResult.data;

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

    // Check R2 storage for actual highest version number
    let storageVersion = 0;
    try {
      const r2 = getR2Client();
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME!,
        Prefix: `thumbnails/${circuitId}-v`,
      });
      const listResult = await r2.send(listCommand);

      if (listResult.Contents && listResult.Contents.length > 0) {
        const versions = listResult.Contents.map((obj) => {
          const match = obj.Key?.match(new RegExp(`${circuitId}-v(\\d+)-`));
          return match ? parseInt(match[1], 10) : 0;
        }).filter((v) => v > 0);

        if (versions.length > 0) {
          storageVersion = Math.max(...versions);
        }
      }
    } catch (storageError) {
      console.warn("Could not check R2 storage versions:", storageError);
      // Continue with database version if storage check fails
    }

    const dbVersion = circuit.thumbnail_version || 0;
    console.log(
      `[Thumbnail Regen] Circuit ${circuitId}: DB version=${dbVersion}, Storage version=${storageVersion}`,
    );

    // Atomically increment version using optimistic locking with retry
    // Use the highest version from either database or storage as the starting point
    let newVersion: number | null = null;
    let retries = 0;
    const MAX_RETRIES = 3;

    while (newVersion === null && retries < MAX_RETRIES) {
      const currentVersion = Math.max(
        circuit.thumbnail_version || 0,
        storageVersion,
      );
      const nextVersion = currentVersion + 1;

      // Atomic update: only succeed if version hasn't changed (optimistic lock)
      const { data: updated, error: updateError } = await adminSupabase
        .from("circuits")
        .update({ thumbnail_version: nextVersion })
        .eq("id", circuitId)
        .eq("thumbnail_version", currentVersion) // Optimistic lock
        .select("thumbnail_version")
        .single();

      if (!updateError && updated) {
        newVersion = updated.thumbnail_version;
      } else {
        // Version changed, retry
        retries++;
        if (retries >= MAX_RETRIES) {
          return createErrorResponse(
            ErrorCategory.CONFLICT,
            "Version allocation failed",
            `Unable to allocate thumbnail version after ${MAX_RETRIES} attempts due to concurrent updates`,
            "Please try again in a moment",
            409,
          );
        }
        // Re-fetch current version for next retry
        const { data: refreshed } = await adminSupabase
          .from("circuits")
          .select("thumbnail_version")
          .eq("id", circuitId)
          .single();
        if (refreshed) {
          circuit.thumbnail_version = refreshed.thumbnail_version;
        }
      }
    }

    // Convert base64 to buffer for upload to R2 (with versioning)
    const uploadThumbnail = async (
      base64Data: string,
      theme: "light" | "dark",
    ) => {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64String, "base64");

      const key = `thumbnails/${circuitId}-v${newVersion}-${theme}.png`;

      // Upload to R2
      const r2 = getR2Client();
      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      });

      try {
        await r2.send(putCommand);
      } catch (error: any) {
        throw new Error(
          `[STORAGE] Failed to upload ${theme} thumbnail to R2: ${error.message}`,
        );
      }

      // Return public URL
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
      return publicUrl;
    };

    // Upload both thumbnails
    const lightUrl = await uploadThumbnail(lightThumbBase64, "light");
    const darkUrl = await uploadThumbnail(darkThumbBase64, "dark");

    // Try to save to thumbnail_history table (optional - table may not exist)
    try {
      // Mark previous versions as not current
      const { error: historyUpdateError } = await adminSupabase
        .from("thumbnail_history")
        .update({ is_current: false })
        .eq("circuit_id", circuitId)
        .eq("is_current", true);

      if (historyUpdateError) {
        console.warn(
          "Error updating thumbnail history (non-critical):",
          historyUpdateError,
        );
      }

      // Insert new version into history
      const { error: historyInsertError } = await adminSupabase
        .from("thumbnail_history")
        .insert({
          circuit_id: circuitId,
          version: newVersion,
          thumbnail_light_url: lightUrl,
          thumbnail_dark_url: darkUrl,
          regenerated_by: user.id,
          is_current: true,
          notes: "Admin regeneration",
        });

      if (historyInsertError) {
        console.warn(
          "Error inserting thumbnail history (non-critical):",
          historyInsertError,
        );
      }
    } catch (historyError: any) {
      // Thumbnail history is optional - log but don't fail the request
      console.warn(
        "Thumbnail history operations skipped (table may not exist):",
        historyError.message,
      );
    }

    // Update circuit record with new thumbnail URLs (version already set atomically)
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

    return NextResponse.json({
      success: true,
      lightUrl,
      darkUrl,
      version: newVersion,
      message: `Thumbnails uploaded successfully (v${newVersion})`,
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
