/**
 * Circuit create/edit/delete and schematic/thumbnail uploads by the owner.
 * Ports of src/app/api/{circuits,circuits/[id],upload-schematic,
 * upload-thumbnail}/route.ts.
 */

import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateSExpression, type SheetSize } from "../../src/lib/kicad-parser";
import { MAX_RAW_SEXPR_BYTES } from "../../src/lib/circuit-limits";
import {
  CreateCircuitSchema,
  baseSlugFor,
  type CreateCircuitInput,
} from "../../src/lib/circuit-input";
import type { ThumbnailTheme } from "../../src/lib/r2-keys";
import {
  recordThumbnailHistoryWith,
  reserveThumbnailVersionWith,
} from "../../src/lib/thumbnail-versions-core";
import type { AppEnv } from "../env";
import { getRequestUser, requireCircuitOwnerOrAdmin } from "../auth";
import { createCircuitStorage } from "../r2";
import { createAdminClient, createUserClient } from "../supabase";
import { requestRebuild } from "../rebuild";

const circuitRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// POST /api/circuits
// ---------------------------------------------------------------------------

// JSON escaping (quotes, newlines) can roughly double the schematic's size on
// the wire, so allow headroom over the raw_sexpr cap before parsing the body.
const MAX_BODY_BYTES = 3 * MAX_RAW_SEXPR_BYTES;
const MAX_SLUG_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

/**
 * Find the first free slug among base, base-2, base-3, ... using the admin
 * client, which sees every row (including other users' private circuits).
 */
async function findAvailableSlug(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  // base only contains [a-z0-9-], so it has no regex metacharacters. Match
  // exactly base and base-<n>, not every slug that merely starts with base.
  const { data, error } = await admin
    .from("circuits")
    .select("slug")
    .filter("slug", "match", `^${base}(-[0-9]+)?$`);
  if (error) throw error;

  const taken = new Set((data ?? []).map((row) => row.slug as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Create a circuit for the signed-in user. Validates input and schematic on
 * the server, picks a unique slug, inserts the row and uploads the processed
 * schematic to R2; if R2 fails the row is deleted again. Returns { id, slug }.
 */
circuitRoutes.post("/api/circuits", async (c) => {
  const user = await getRequestUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized - Please sign in" }, 401);
  }

  const badRequest = (error: string, details?: unknown) =>
    c.json(details === undefined ? { error } : { error, details }, 400);

  // Parse the body with a size cap
  let body: unknown;
  try {
    const text = await c.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return c.json({ error: "Request body too large" }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = CreateCircuitSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Invalid circuit data",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  const input: CreateCircuitInput = parsed.data;

  // Re-validate the schematic server-side and derive its stats
  const validation = validateSExpression(input.raw_sexpr);
  if (!validation.valid || !validation.metadata) {
    return badRequest("Invalid KiCad schematic", validation.errors);
  }
  const { stats } = validation.metadata;

  const baseSlug = baseSlugFor(input);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient(c.env);
  } catch (error) {
    console.error("POST /api/circuits: admin client unavailable:", error);
    return c.json({ error: "Internal server error" }, 500);
  }

  // Insert, retrying with a fresh slug if another insert takes ours first
  let circuit: { id: string; slug: string } | null = null;
  try {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !circuit; attempt++) {
      const slug = await findAvailableSlug(admin, baseSlug);
      const { data, error } = await admin
        .from("circuits")
        .insert({
          user_id: user.id,
          slug,
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          license: input.license,
          is_public: input.is_public,
          sheet_size: input.sheet_size,
          raw_sexpr: input.raw_sexpr,
          component_count: stats.componentCount,
          wire_count: stats.wireCount,
          net_count: stats.netCount,
          // No thumbnails yet; the first upload reserves v1
          thumbnail_version: 0,
        })
        .select("id, slug")
        .single();

      if (!error) {
        circuit = data;
      } else if (error.code !== UNIQUE_VIOLATION) {
        throw error;
      }
    }
  } catch (error) {
    console.error("POST /api/circuits: insert failed:", error);
    return c.json({ error: "Failed to create circuit" }, 500);
  }

  if (!circuit) {
    return c.json(
      { error: "Could not find an available URL slug, please try again" },
      409,
    );
  }

  // Upload the processed schematic to R2. Undo the insert on failure.
  const storage = createCircuitStorage(c.env);
  let uploaded = false;
  try {
    const r2Url = await storage.processAndUploadSchematic({
      circuitId: circuit.id,
      rawSexpr: input.raw_sexpr,
      title: input.title,
      sheetSizeOverride: input.sheet_size,
    });
    uploaded = true;

    const { error } = await admin
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", circuit.id);
    if (error) throw error;
  } catch (error) {
    console.error("POST /api/circuits: schematic upload failed:", error);

    const { error: deleteError } = await admin
      .from("circuits")
      .delete()
      .eq("id", circuit.id);
    if (deleteError) {
      console.error(
        `POST /api/circuits: failed to roll back circuit ${circuit.id}:`,
        deleteError,
      );
    }
    if (uploaded) {
      await storage
        .deleteSchematic(circuit.id)
        .catch((r2Error) =>
          console.error("POST /api/circuits: R2 cleanup failed:", r2Error),
        );
    }

    return c.json({ error: "Failed to store schematic, please try again" }, 502);
  }

  return c.json({ id: circuit.id, slug: circuit.slug }, 201);
});

// ---------------------------------------------------------------------------
// PUT /api/circuits/:id
// ---------------------------------------------------------------------------

/**
 * Update circuit metadata (title, description, tags, category, license,
 * is_public, sheet_size) or thumbnails. Owner only. Runs as the user, so RLS
 * and the guard_circuit_writes trigger apply.
 */
circuitRoutes.put("/api/circuits/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await getRequestUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized - Please sign in" }, 401);
    }
    const supabase = createUserClient(c.env, user.token);

    // Get the circuit to verify ownership
    const { data: circuit, error: fetchError } = await supabase
      .from("circuits")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !circuit) {
      return c.json({ error: "Circuit not found" }, 404);
    }

    if (circuit.user_id !== user.id) {
      return c.json(
        { error: "Forbidden - You can only edit your own circuits" },
        403,
      );
    }

    const body = await c.req.json();
    const {
      title,
      description,
      tags,
      category,
      license,
      is_public,
      sheet_size,
      thumbnail_light_url,
      thumbnail_dark_url,
    } = body;
    // thumbnail_version is not accepted here: /api/upload-thumbnail reserves
    // versions so their R2 keys are never reused.

    // Thumbnails must be this circuit's own files in our R2 bucket, so a
    // circuit can't be pointed at arbitrary external images. Compare the
    // parsed origin and normalized path (URL parsing resolves "../").
    const r2Origin = new URL(c.env.R2_PUBLIC_URL).origin;
    const thumbnailDir = `/thumbnails/${id}/`;
    const isOwnThumbnail = (value: unknown) => {
      if (typeof value !== "string") return false;
      try {
        const url = new URL(value);
        return url.origin === r2Origin && url.pathname.startsWith(thumbnailDir);
      } catch {
        return false;
      }
    };
    for (const url of [thumbnail_light_url, thumbnail_dark_url]) {
      if (url !== undefined && url !== null && !isOwnThumbnail(url)) {
        return c.json({ error: "Invalid thumbnail URL" }, 400);
      }
    }

    // Only include fields that are provided
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const isThumbnailOnlyUpdate =
      thumbnail_light_url &&
      thumbnail_dark_url &&
      !title &&
      !description &&
      !tags &&
      !license;

    if (isThumbnailOnlyUpdate) {
      updateData.thumbnail_light_url = thumbnail_light_url;
      updateData.thumbnail_dark_url = thumbnail_dark_url;
    } else {
      if (!title || !description || !tags || !license) {
        return c.json(
          {
            error: "Missing required fields: title, description, tags, license",
          },
          400,
        );
      }

      if (title.length > 150) {
        return c.json({ error: "Title must be 150 characters or less" }, 400);
      }

      if (description.length > 10000) {
        return c.json(
          { error: "Description must be 10,000 characters or less" },
          400,
        );
      }

      if (!Array.isArray(tags) || tags.length === 0) {
        return c.json({ error: "At least one tag is required" }, 400);
      }

      if (tags.length > 10) {
        return c.json({ error: "Maximum 10 tags allowed" }, 400);
      }

      for (const tag of tags) {
        if (typeof tag !== "string" || tag.length > 30) {
          return c.json(
            { error: "Each tag must be a string with maximum 30 characters" },
            400,
          );
        }
      }

      updateData.title = title.trim();
      updateData.description = description.trim();
      updateData.tags = tags;
      updateData.category = category || null;
      updateData.license = license;
      updateData.is_public = is_public !== undefined ? is_public : true;

      // sheet_size can be null, A4, A3, or A2
      if (sheet_size !== undefined) {
        if (sheet_size !== null && !["A4", "A3", "A2"].includes(sheet_size)) {
          return c.json(
            { error: "Invalid sheet_size. Must be A4, A3, A2, or null" },
            400,
          );
        }
        updateData.sheet_size = sheet_size;
      }

      if (thumbnail_light_url) {
        updateData.thumbnail_light_url = thumbnail_light_url;
      }
      if (thumbnail_dark_url) updateData.thumbnail_dark_url = thumbnail_dark_url;
    }

    const { data: updatedCircuit, error: updateError } = await supabase
      .from("circuits")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating circuit:", updateError);
      return c.json({ error: "Failed to update circuit" }, 500);
    }

    // The R2 schematic bakes in the sheet size and title, so rebuild it after a
    // metadata edit. Version the URL so caches pick up the new file. A failure
    // here doesn't fail the save: the previous schematic keeps working.
    let circuitOut = updatedCircuit;
    if (!isThumbnailOnlyUpdate && updatedCircuit?.raw_sexpr) {
      try {
        const r2Url = await createCircuitStorage(
          c.env,
        ).processAndUploadSchematic({
          circuitId: id,
          rawSexpr: updatedCircuit.raw_sexpr,
          title: updatedCircuit.title,
          sheetSizeOverride: (updatedCircuit.sheet_size as SheetSize) ?? null,
        });
        const versionedUrl = `${r2Url}?v=${Date.now()}`;
        const { data: withUrl } = await supabase
          .from("circuits")
          .update({ schematic_r2_url: versionedUrl })
          .eq("id", id)
          .select()
          .single();
        if (withUrl) circuitOut = withUrl;
      } catch (regenError) {
        console.error("Failed to regenerate R2 schematic:", regenError);
      }
    }

    // Rebuild the static page: the title, description or visibility changed
    if (!isThumbnailOnlyUpdate) requestRebuild(c, "circuit edited");

    return c.json({ success: true, circuit: circuitOut });
  } catch (error) {
    console.error("Error in PUT /api/circuits/[id]:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/circuits/:id
// ---------------------------------------------------------------------------

/** Delete a circuit. Owner only; runs as the user (RLS). */
circuitRoutes.delete("/api/circuits/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await getRequestUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized - Please sign in" }, 401);
    }
    const supabase = createUserClient(c.env, user.token);

    const { data: circuit, error: fetchError } = await supabase
      .from("circuits")
      .select("user_id, slug")
      .eq("id", id)
      .single();

    if (fetchError || !circuit) {
      return c.json({ error: "Circuit not found" }, 404);
    }

    if (circuit.user_id !== user.id) {
      return c.json(
        { error: "Forbidden - You can only delete your own circuits" },
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("circuits")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting circuit:", deleteError);
      return c.json({ error: "Failed to delete circuit" }, 500);
    }

    // Remove the circuit's public files from R2 (best effort)
    try {
      await createCircuitStorage(c.env).deleteCircuitFiles(id);
    } catch (r2Error) {
      console.error("Circuit deleted but R2 cleanup failed:", r2Error);
    }

    // Remove its static page
    requestRebuild(c, "circuit deleted");

    return c.json({ success: true, message: "Circuit deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/circuits/[id]:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/upload-schematic
// ---------------------------------------------------------------------------

const VALID_SHEET_SIZES = new Set(["A4", "A3", "A2"]);

/**
 * (Re)generate a circuit's processed schematic in R2, always from the stored
 * raw_sexpr, title and sheet_size, never from the request body.
 */
circuitRoutes.post("/api/upload-schematic", async (c) => {
  try {
    const { circuitId } =
      ((await c.req.json().catch(() => null)) as { circuitId?: unknown } | null) ??
      {};

    const access = await requireCircuitOwnerOrAdmin(c, circuitId);
    if (!access.ok) {
      return c.json({ error: access.error }, access.status);
    }
    const id = circuitId as string;

    const supabase = createAdminClient(c.env);
    const { data: circuit, error: fetchError } = await supabase
      .from("circuits")
      .select("raw_sexpr, title, sheet_size")
      .eq("id", id)
      .single();

    if (fetchError || !circuit?.raw_sexpr) {
      return c.json({ error: "Circuit has no schematic data" }, 404);
    }

    const sheetSize =
      circuit.sheet_size && VALID_SHEET_SIZES.has(circuit.sheet_size)
        ? (circuit.sheet_size as SheetSize)
        : null;

    const r2Url = await createCircuitStorage(c.env).processAndUploadSchematic({
      circuitId: id,
      rawSexpr: circuit.raw_sexpr,
      title: circuit.title,
      sheetSizeOverride: sheetSize,
    });

    const { error: dbError } = await supabase
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", id);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return c.json(
        { error: "Uploaded to R2 but failed to update database", url: r2Url },
        500,
      );
    }

    return c.json({ success: true, circuitId: id, url: r2Url });
  } catch (error) {
    console.error("Schematic upload failed:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/upload-thumbnail
// ---------------------------------------------------------------------------

// Max decoded size per thumbnail image
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_HISTORY_NOTE_LENGTH = 200;

/**
 * Decode a `data:image/png;base64,...` URL into PNG bytes.
 * Returns an error string if the data is not a valid, reasonably sized PNG.
 */
export function decodePngDataUrl(dataUrl: unknown): Uint8Array | string {
  if (typeof dataUrl !== "string") return "Thumbnail must be a data URL";
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return "Thumbnail must be a base64 PNG data URL";

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_THUMBNAIL_BYTES) return "Thumbnail too large";
  if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    return "Thumbnail is not a valid PNG";
  }
  return bytes;
}

/**
 * Body: { circuitId, lightDataUrl?, darkDataUrl?, historyNote? }
 *
 * Reserves a new thumbnail version N before writing anything, stores the
 * images at the immutable keys `thumbnails/<id>/v<N>-<theme>.png` and points
 * the circuit at them. A request with both themes is also recorded in
 * thumbnail_history as the current version.
 *
 * Response: { success, circuitId, urls: { light?, dark? }, version }
 */
circuitRoutes.post("/api/upload-thumbnail", async (c) => {
  try {
    const body =
      ((await c.req.json().catch(() => null)) as Record<string, unknown> | null) ??
      {};
    const { lightDataUrl, darkDataUrl, historyNote } = body;
    const circuitId: unknown =
      typeof body.circuitId === "string"
        ? body.circuitId.toLowerCase()
        : body.circuitId;

    const access = await requireCircuitOwnerOrAdmin(c, circuitId);
    if (!access.ok) {
      return c.json({ error: access.error }, access.status);
    }
    const id = circuitId as string;

    if (!lightDataUrl && !darkDataUrl) {
      return c.json({ error: "Missing thumbnail data" }, 400);
    }

    if (
      historyNote !== undefined &&
      (typeof historyNote !== "string" ||
        historyNote.length > MAX_HISTORY_NOTE_LENGTH)
    ) {
      return c.json(
        {
          error: `historyNote must be a string of at most ${MAX_HISTORY_NOTE_LENGTH} characters`,
        },
        400,
      );
    }

    const images: { theme: ThumbnailTheme; bytes: Uint8Array }[] = [];
    for (const [theme, dataUrl] of [
      ["light", lightDataUrl],
      ["dark", darkDataUrl],
    ] as const) {
      if (!dataUrl) continue;
      const decoded = decodePngDataUrl(dataUrl);
      if (typeof decoded === "string") {
        return c.json({ error: decoded }, 400);
      }
      images.push({ theme, bytes: decoded });
    }

    const admin = createAdminClient(c.env);
    const storage = createCircuitStorage(c.env);

    // Reserve the version before uploading so no two requests share a key
    const reservation = await reserveThumbnailVersionWith(
      { admin, listCircuitThumbnails: (cid) => storage.listCircuitThumbnails(cid) },
      id,
      access.circuit.thumbnail_version,
    );
    if (!reservation.ok) {
      return c.json(
        {
          error:
            reservation.reason === "not_found"
              ? "Circuit not found"
              : reservation.reason === "exhausted"
                ? "Thumbnail version limit reached"
                : "Another thumbnail upload is in progress; please retry",
        },
        reservation.reason === "not_found" ? 404 : 409,
      );
    }
    const version = reservation.version;

    const results: { light?: string; dark?: string } = {};
    for (const { theme, bytes } of images) {
      results[theme] = await storage.uploadThumbnailObject(
        id,
        version,
        theme,
        bytes,
      );
    }

    // Point the circuit at the new images (thumbnail_version is already N)
    const updateData: {
      thumbnail_light_url?: string;
      thumbnail_dark_url?: string;
    } = {};
    if (results.light) updateData.thumbnail_light_url = results.light;
    if (results.dark) updateData.thumbnail_dark_url = results.dark;

    const { error: dbError } = await admin
      .from("circuits")
      .update(updateData)
      .eq("id", id);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return c.json(
        {
          error: "Uploaded to R2 but failed to update database",
          urls: results,
          version,
        },
        500,
      );
    }

    if (results.light && results.dark) {
      // History is an audit trail; failures here don't fail the upload
      const historyError = await recordThumbnailHistoryWith(admin, {
        circuitId: id,
        version,
        lightUrl: results.light,
        darkUrl: results.dark,
        regeneratedBy: access.user.id,
        notes: (historyNote as string | undefined) || null,
      });
      if (historyError) {
        console.warn(
          "Thumbnail history update failed (non-critical):",
          historyError,
        );
      }
    }

    return c.json({ success: true, circuitId: id, urls: results, version });
  } catch (error) {
    console.error("Upload failed:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

export default circuitRoutes;
