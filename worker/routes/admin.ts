/**
 * Admin routes. Ports of src/app/api/admin/*\/route.ts. Every handler calls
 * requireAdmin() first; only batch-import also accepts ADMIN_API_KEY.
 */

import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  validateImportBatch,
  type ImportRecord,
} from "../../src/lib/batch-import/validator";
import { transformToCircuit } from "../../src/lib/batch-import/transformer";
import { generateUniqueSlug } from "../../src/lib/batch-import/slug-generator";
import { addGitHubAttribution } from "../../src/lib/kicad-parser";
import { parseThumbnailKey } from "../../src/lib/r2-keys";
import {
  recordThumbnailHistoryWith,
  reserveThumbnailVersionWith,
} from "../../src/lib/thumbnail-versions-core";
import { deleteUserAccountWith } from "../../src/lib/account-deletion-core";
import { accountDeletionDeps } from "../account";
import type { AppEnv } from "../env";
import { isUuid, requireAdmin } from "../auth";
import { createCircuitStorage } from "../r2";
import { createAdminClient } from "../supabase";

type Ctx = Context<AppEnv>;

const adminRoutes = new Hono<AppEnv>();

// Error categories used by the thumbnail admin routes
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

function errorResponse(
  c: Ctx,
  category: ErrorCategory,
  message: string,
  details?: string,
  suggestion?: string,
  status: ContentfulStatusCode = 500,
) {
  return c.json(
    {
      error: message,
      category,
      details,
      suggestion,
      timestamp: new Date().toISOString(),
    },
    status,
  );
}

function authErrorResponse(c: Ctx, status: 401 | 403, error: string) {
  return errorResponse(
    c,
    status === 401 ? ErrorCategory.AUTHENTICATION : ErrorCategory.AUTHORIZATION,
    error,
    undefined,
    status === 401
      ? "Please log in again to get a fresh authentication token"
      : "Contact an administrator if you believe you should have access",
    status,
  );
}

// ---------------------------------------------------------------------------
// /api/admin/batch-import
// ---------------------------------------------------------------------------

interface ImportResult {
  source_file_id: string;
  status: "success" | "skipped" | "error";
  circuit_id?: string;
  slug?: string;
  reason?: string;
  error?: string;
}

adminRoutes.post("/api/admin/batch-import", async (c) => {
  try {
    // ADMIN_API_KEY or an admin session
    const auth = await requireAdmin(c, { allowApiKey: true });
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await c.req.json();
    const { records } = body;

    if (!records) {
      return c.json({ error: 'Missing "records" array in request body' }, 400);
    }

    let validationResults;
    try {
      validationResults = validateImportBatch(records);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }

    const botUserId = c.env.BOT_USER_ID;
    if (!botUserId) {
      console.error("BOT_USER_ID not configured in environment variables");
      return c.json(
        { error: "Server configuration error - BOT_USER_ID not set" },
        500,
      );
    }

    const supabase = createAdminClient(c.env);
    const storage = createCircuitStorage(c.env);

    const results: ImportResult[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record: ImportRecord = records[i];
      const validation = validationResults[i];

      if (!validation.valid) {
        results.push({
          source_file_id: record.source_file_id || `unknown-${i}`,
          status: "error",
          error: validation.errors.join(", "),
        });
        failedCount++;
        continue;
      }

      try {
        const slug = await generateUniqueSlug(
          supabase,
          record.subcircuit.name,
          record.repo_name,
        );

        const attributedSexpr = addGitHubAttribution(record.raw_sexpr, {
          repoOwner: record.repo_owner,
          repoName: record.repo_name,
          repoUrl: record.repo_url,
          filePath: record.file_path,
          license: record.repo_license,
          score: record.classification_score,
        });

        const circuitData = transformToCircuit(
          { ...record, raw_sexpr: attributedSexpr },
          slug,
          botUserId,
        );

        const { data: insertedCircuit, error: insertError } = await supabase
          .from("circuits")
          .insert(circuitData)
          .select("id, slug")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            results.push({
              source_file_id: record.source_file_id,
              status: "skipped",
              reason: `Duplicate slug: ${slug}`,
            });
            skippedCount++;
          } else {
            throw insertError;
          }
        } else {
          try {
            const r2Url = await storage.processAndUploadSchematic({
              circuitId: insertedCircuit.id,
              rawSexpr: attributedSexpr,
              title: record.subcircuit.name,
              sheetSizeOverride: null, // Auto-detect for batch imports
            });
            await supabase
              .from("circuits")
              .update({ schematic_r2_url: r2Url })
              .eq("id", insertedCircuit.id);
          } catch (r2Error) {
            // Not fatal: /api/schematic regenerates from raw_sexpr on demand
            console.error(
              `Failed to upload schematic to R2 for ${insertedCircuit.id}:`,
              r2Error,
            );
          }

          results.push({
            source_file_id: record.source_file_id,
            status: "success",
            circuit_id: insertedCircuit.id,
            slug: insertedCircuit.slug,
          });
          importedCount++;
        }
      } catch (error: any) {
        console.error(`Error importing record ${record.source_file_id}:`, error);
        results.push({
          source_file_id: record.source_file_id,
          status: "error",
          error: error.message || "Unknown error",
        });
        failedCount++;
      }
    }

    return c.json({
      success: true,
      batch_id: `batch-${Date.now()}`,
      results: {
        total: records.length,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      details: results,
    });
  } catch (error: any) {
    console.error("Error in batch import:", error);
    return c.json(
      { error: "Internal server error", message: error.message },
      500,
    );
  }
});

adminRoutes.get("/api/admin/batch-import", (c) =>
  c.json({
    endpoint: "POST /api/admin/batch-import",
    description: "Batch import circuits from external scrapers",
    authentication: "Bearer token in Authorization header",
    request_format: {
      records: [
        {
          source_file_id: "string",
          repo_owner: "string",
          repo_name: "string",
          repo_url: "string",
          repo_license: "string",
          file_path: "string",
          raw_sexpr: "string (KiCad S-expression)",
          component_count: "number",
          classification_score: "number (0-10)",
          subcircuit: {
            name: "string (max 100 chars)",
            description: "string",
            components: "string (optional)",
            useCase: "string (optional)",
            notes: "string (optional)",
            tags: ["array of strings (max 10, each max 30 chars)"],
          },
        },
      ],
    },
    limits: {
      max_records_per_batch: 100,
      title_max_length: 100,
      description_max_length: 1000,
      tag_max_count: 10,
      tag_max_length: 30,
    },
    response_format: {
      success: "boolean",
      batch_id: "string",
      results: {
        total: "number",
        imported: "number",
        skipped: "number",
        failed: "number",
      },
      details: [
        {
          source_file_id: "string",
          status: "success | skipped | error",
          circuit_id: "string (if success)",
          slug: "string (if success)",
          reason: "string (if skipped)",
          error: "string (if error)",
        },
      ],
    },
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/delete-all-thumbnails
// ---------------------------------------------------------------------------

/**
 * Delete every thumbnail of the circuitsnips-importer's circuits: R2 files,
 * thumbnail_history rows, and the thumbnail URLs on the circuits.
 */
adminRoutes.delete("/api/admin/delete-all-thumbnails", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return authErrorResponse(c, auth.status, auth.error);

    const adminClient = createAdminClient(c.env);

    const { data: importerUser, error: importerError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", "circuitsnips-importer")
      .single();

    if (importerError || !importerUser) {
      return errorResponse(
        c,
        ErrorCategory.NOT_FOUND,
        "Importer user not found",
        "The circuitsnips-importer user does not exist in the database",
        "Ensure the importer user account has been created",
        404,
      );
    }

    // Fetch every importer circuit, paging past the 1000-row cap
    let allCircuits: any[] = [];
    const pageSize = 1000;
    for (let page = 0; ; page++) {
      const { data: circuits, error: fetchError } = await adminClient
        .from("circuits")
        .select("id, user_id, thumbnail_light_url, thumbnail_dark_url")
        .eq("user_id", importerUser.id)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error("Error fetching circuits:", fetchError);
        return errorResponse(
          c,
          ErrorCategory.DATABASE,
          "Failed to fetch circuits",
          fetchError.message,
          "Database query failed. Please try again",
          500,
        );
      }
      if (!circuits || circuits.length === 0) break;
      allCircuits = allCircuits.concat(circuits);
      if (circuits.length < pageSize) break;
    }

    console.log(
      `Found ${allCircuits.length} total circuits for circuitsnips-importer`,
    );

    if (allCircuits.length === 0) {
      return c.json({
        success: true,
        message: "No circuits found for circuitsnips-importer",
        deletedCount: 0,
      });
    }

    const circuits = allCircuits;

    let deletedFiles = 0;
    let failedFiles = 0;
    try {
      const storage = createCircuitStorage(c.env);
      const circuitIdSet = new Set(
        circuits.map((circuit) => String(circuit.id).toLowerCase()),
      );

      // parseThumbnailKey matches every layout and returns lowercase ids
      const keysToDelete = (await storage.listKeys("thumbnails/")).filter(
        (key) => {
          const parsed = parseThumbnailKey(key);
          return parsed !== null && circuitIdSet.has(parsed.circuitId);
        },
      );
      console.log(`Found ${keysToDelete.length} thumbnail files to delete in R2`);

      const deleteResult = await storage.deleteKeys(keysToDelete);
      deletedFiles = deleteResult.deleted;
      failedFiles = deleteResult.failed;
    } catch (error) {
      console.error("Error processing R2 files:", error);
      // Continue to database update even if file deletion fails
    }

    // Chunk the ids: thousands in one `.in()` overflow the URL length limit
    const circuitIds = circuits.map((circuit) => circuit.id);
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

    // thumbnail_version is deliberately kept: versioned keys are cached as
    // immutable, so the next regeneration must not reuse old numbers.
    const { error: updateError } = await adminClient
      .from("circuits")
      .update({ thumbnail_light_url: null, thumbnail_dark_url: null })
      .eq("user_id", importerUser.id);

    if (updateError) {
      console.error("Error updating database:", updateError);
      return errorResponse(
        c,
        ErrorCategory.DATABASE,
        "Failed to update circuit records",
        updateError.message,
        "Storage files were deleted but database update failed. Please try deleting again.",
        500,
      );
    }

    return c.json({
      success: true,
      message: `Deleted all thumbnails from ${circuits.length} @circuitsnips-importer circuits`,
      circuitsUpdated: circuits.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles,
      historyChunksFailed,
    });
  } catch (error: any) {
    console.error("Error in delete-all-thumbnails:", error);

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

    return errorResponse(
      c,
      category,
      "Bulk thumbnail deletion failed",
      error.message || "Unknown error",
      suggestion,
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// /api/admin/delete-circuit
// ---------------------------------------------------------------------------

adminRoutes.delete("/api/admin/delete-circuit", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const { circuitId } = await c.req.json();
    if (!isUuid(circuitId)) {
      return c.json(
        { error: "Missing or invalid circuitId in request body" },
        400,
      );
    }

    // Cascades handle related rows
    const { error } = await createAdminClient(c.env)
      .from("circuits")
      .delete()
      .eq("id", circuitId);

    if (error) {
      console.error("Error deleting circuit:", error);
      return c.json(
        { error: "Failed to delete circuit", details: error.message },
        500,
      );
    }

    // Remove the circuit's public files from R2 (best effort)
    try {
      await createCircuitStorage(c.env).deleteCircuitFiles(circuitId);
    } catch (r2Error) {
      console.error("Circuit deleted but R2 cleanup failed:", r2Error);
    }

    return c.json({ success: true, message: "Circuit deleted successfully" });
  } catch (error: any) {
    console.error("Error in delete circuit endpoint:", error);
    return c.json(
      { error: "Internal server error", message: error.message },
      500,
    );
  }
});

adminRoutes.get("/api/admin/delete-circuit", (c) =>
  c.json({
    endpoint: "DELETE /api/admin/delete-circuit",
    description: "Delete a circuit (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      circuitId: "string (UUID)",
    },
  }),
);

// ---------------------------------------------------------------------------
// /api/admin/delete-user (DELETE deletes, POST searches users)
// ---------------------------------------------------------------------------

adminRoutes.delete("/api/admin/delete-user", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const supabase = createAdminClient(c.env);
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    if (userId === auth.user.id) {
      return c.json({ error: "Cannot delete your own admin account" }, 400);
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, id")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      return c.json({ error: "User not found" }, 404);
    }

    // Deletes the login(s) and the profile, which cascades to all related
    // data; R2 files and the WorkOS user are cleaned up afterwards
    const { circuitCount } = await deleteUserAccountWith(
      accountDeletionDeps(c.env),
      userId,
    );

    return c.json({
      success: true,
      message: `User @${userProfile.username} deleted successfully`,
      deletedUser: {
        id: userProfile.id,
        username: userProfile.username,
        circuitCount: circuitCount || 0,
      },
    });
  } catch (error: any) {
    console.error("Error in delete-user:", error);
    return c.json({ error: error.message || "Failed to delete user" }, 500);
  }
});

// PostgREST caps a single response at 1000 rows
const PAGE_SIZE = 1000;

/** Every row of `table` owned by any of `userIds`, paging past the cap. */
async function fetchRowsForUsers<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  userIds: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("user_id", userIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

adminRoutes.post("/api/admin/delete-user", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }
    const supabase = createAdminClient(c.env);

    const { searchQuery, limit = 50 } = await c.req.json();
    const pageLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(pageLimit);

    if (typeof searchQuery === "string" && searchQuery.trim()) {
      query = query.ilike("username", `%${searchQuery.trim()}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return c.json({ users: [] });
    }

    // One paged query per table instead of several per user. The admin
    // client sees private circuits too.
    const userIds = profiles.map((profile) => profile.id as string);
    const [circuits, comments, favorites] = await Promise.all([
      fetchRowsForUsers<{ user_id: string; copy_count: number | null }>(
        supabase,
        "circuits",
        "user_id, copy_count",
        userIds,
      ),
      fetchRowsForUsers<{ user_id: string }>(
        supabase,
        "circuit_comments",
        "user_id",
        userIds,
      ),
      fetchRowsForUsers<{ user_id: string }>(
        supabase,
        "favorites",
        "user_id",
        userIds,
      ),
    ]);

    const stats = new Map(
      userIds.map((id) => [
        id,
        { circuitCount: 0, totalCopies: 0, commentCount: 0, favoriteCount: 0 },
      ]),
    );
    for (const circuit of circuits) {
      const userStats = stats.get(circuit.user_id);
      if (!userStats) continue;
      userStats.circuitCount++;
      userStats.totalCopies += circuit.copy_count || 0;
    }
    for (const comment of comments) {
      const userStats = stats.get(comment.user_id);
      if (userStats) userStats.commentCount++;
    }
    for (const favorite of favorites) {
      const userStats = stats.get(favorite.user_id);
      if (userStats) userStats.favoriteCount++;
    }

    return c.json({
      users: profiles.map((profile) => ({
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        ...stats.get(profile.id)!,
      })),
    });
  } catch (error: any) {
    console.error("Error searching users:", error);
    return c.json({ error: error.message || "Failed to search users" }, 500);
  }
});

// ---------------------------------------------------------------------------
// /api/admin/regenerate-thumbnail
// ---------------------------------------------------------------------------

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

adminRoutes.post("/api/admin/regenerate-thumbnail", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return authErrorResponse(c, auth.status, auth.error);
    const { user } = auth;

    const adminSupabase = createAdminClient(c.env);
    const body = await c.req.json();

    const validationResult = RegenerateThumbnailSchema.safeParse(body);
    if (!validationResult.success) {
      const fieldErrors = validationResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(
        c,
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

    const { data: circuit, error: circuitError } = await adminSupabase
      .from("circuits")
      .select("id, user_id, thumbnail_version")
      .eq("id", circuitId)
      .single();

    if (circuitError || !circuit) {
      return errorResponse(
        c,
        ErrorCategory.NOT_FOUND,
        "Circuit not found",
        circuitError?.message || `No circuit exists with ID: ${circuitId}`,
        "Verify the circuit ID is correct and the circuit has not been deleted",
        404,
      );
    }

    // Prevent regenerating the wrong user's thumbnails
    if (circuit.user_id !== userId) {
      return errorResponse(
        c,
        ErrorCategory.VALIDATION,
        "Circuit ownership mismatch",
        `Circuit ${circuitId} belongs to user ${circuit.user_id}, not ${userId}`,
        "Ensure the userId matches the circuit owner",
        400,
      );
    }

    const storage = createCircuitStorage(c.env);

    let reservation;
    try {
      reservation = await reserveThumbnailVersionWith(
        {
          admin: adminSupabase,
          listCircuitThumbnails: (id) => storage.listCircuitThumbnails(id),
        },
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
        return errorResponse(
          c,
          ErrorCategory.NOT_FOUND,
          "Circuit not found",
          `Circuit ${circuitId} was deleted during regeneration`,
          undefined,
          404,
        );
      }
      return errorResponse(
        c,
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

    const uploadThumbnail = async (
      base64Data: string,
      theme: "light" | "dark",
    ) => {
      const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Buffer.from(base64String, "base64");
      try {
        return await storage.uploadThumbnailObject(
          circuitId,
          version,
          theme,
          bytes,
        );
      } catch (error: any) {
        throw new Error(
          `[STORAGE] Failed to upload ${theme} thumbnail to R2: ${error.message}`,
        );
      }
    };

    const lightUrl = await uploadThumbnail(lightThumbBase64, "light");
    const darkUrl = await uploadThumbnail(darkThumbBase64, "dark");

    const { error: updateError } = await adminSupabase
      .from("circuits")
      .update({ thumbnail_light_url: lightUrl, thumbnail_dark_url: darkUrl })
      .eq("id", circuitId);

    if (updateError) {
      console.error("Error updating circuit with thumbnail URLs:", updateError);
      return errorResponse(
        c,
        ErrorCategory.DATABASE,
        "Failed to update circuit record",
        updateError.message,
        "The thumbnails were uploaded but could not be linked to the circuit. Please try regenerating again.",
        500,
      );
    }

    // History is an audit trail; failures here don't fail the request
    const historyError = await recordThumbnailHistoryWith(adminSupabase, {
      circuitId,
      version,
      lightUrl,
      darkUrl,
      regeneratedBy: user.id,
      notes: "Admin regeneration",
    });
    if (historyError) {
      console.warn("Thumbnail history update failed (non-critical):", historyError);
    }

    return c.json({
      success: true,
      lightUrl,
      darkUrl,
      version,
      message: `Thumbnails uploaded successfully (v${version})`,
    });
  } catch (error: any) {
    console.error("Error in regenerate thumbnail endpoint:", error);

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

    return errorResponse(
      c,
      category,
      "Thumbnail regeneration failed",
      error.message,
      suggestion,
      500,
    );
  }
});

adminRoutes.get("/api/admin/regenerate-thumbnail", (c) =>
  c.json({
    endpoint: "POST /api/admin/regenerate-thumbnail",
    description: "Regenerate thumbnails for a circuit (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      circuitId: "string (UUID)",
      userId: "string (UUID) - owner of the circuit",
      lightThumbBase64: "string (base64 encoded PNG)",
      darkThumbBase64: "string (base64 encoded PNG)",
    },
  }),
);

// ---------------------------------------------------------------------------
// POST /api/admin/sync-stats
// ---------------------------------------------------------------------------

adminRoutes.post("/api/admin/sync-stats", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const supabase = createAdminClient(c.env);

    // sync_global_stats is only executable by the service role
    const { error: syncError } = await supabase.rpc("sync_global_stats");
    if (syncError) {
      console.error("Error syncing global stats:", syncError);
      throw syncError;
    }

    const { data: updatedStats, error: fetchError } = await supabase
      .from("global_stats")
      .select("*")
      .eq("id", 1)
      .single();
    if (fetchError) {
      console.error("Error fetching updated stats:", fetchError);
      throw fetchError;
    }

    return c.json({
      success: true,
      message: "Global stats synchronized successfully",
      stats: updatedStats,
    });
  } catch (error: any) {
    console.error("Error in sync-stats:", error);
    return c.json({ error: error.message || "Failed to sync stats" }, 500);
  }
});

// ---------------------------------------------------------------------------
// /api/admin/update-flag
// ---------------------------------------------------------------------------

const FLAG_STATUSES = ["pending", "reviewed", "resolved", "dismissed"];

adminRoutes.put("/api/admin/update-flag", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const { flagId, status, adminNotes } = await c.req.json();

    if (!flagId || !status) {
      return c.json({ error: "Missing required fields: flagId, status" }, 400);
    }

    if (!FLAG_STATUSES.includes(status)) {
      return c.json(
        { error: `Invalid status. Must be one of: ${FLAG_STATUSES.join(", ")}` },
        400,
      );
    }

    const { error } = await createAdminClient(c.env)
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
      return c.json(
        { error: "Failed to update flag", details: error.message },
        500,
      );
    }

    return c.json({ success: true, message: "Flag updated successfully" });
  } catch (error: any) {
    console.error("Error in update flag endpoint:", error);
    return c.json(
      { error: "Internal server error", message: error.message },
      500,
    );
  }
});

adminRoutes.get("/api/admin/update-flag", (c) =>
  c.json({
    endpoint: "PUT /api/admin/update-flag",
    description: "Update flag status (admin only)",
    authentication: "Bearer token in Authorization header",
    request_format: {
      flagId: "string (UUID)",
      status: "string (pending | reviewed | resolved | dismissed)",
      adminNotes: "string (optional)",
    },
  }),
);

export default adminRoutes;
