import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCircuitOwnerOrAdmin } from "@/lib/api-auth";
import { uploadThumbnailObject, type ThumbnailTheme } from "@/lib/r2-schematic";
import {
  recordThumbnailHistory,
  reserveThumbnailVersion,
} from "@/lib/thumbnail-versions";

// Max decoded size per thumbnail image
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MAX_HISTORY_NOTE_LENGTH = 200;

/**
 * Decode a `data:image/png;base64,...` URL into a PNG buffer.
 * Returns an error string if the data is not a valid, reasonably sized PNG.
 */
function decodePngDataUrl(dataUrl: unknown): Buffer | string {
  if (typeof dataUrl !== "string") return "Thumbnail must be a data URL";
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return "Thumbnail must be a base64 PNG data URL";

  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > MAX_THUMBNAIL_BYTES) return "Thumbnail too large";
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "Thumbnail is not a valid PNG";
  }
  return buffer;
}

/**
 * POST /api/upload-thumbnail
 *
 * Body: { circuitId, lightDataUrl?, darkDataUrl?, historyNote? }
 *
 * Every request reserves a new thumbnail version N (atomically, on
 * circuits.thumbnail_version) before writing anything, then stores the
 * images at the immutable keys `thumbnails/<id>/v<N>-<theme>.png` and points
 * the circuit at them. Send both themes in one request so they share N; a
 * request with both themes is also recorded in thumbnail_history as the
 * current version, labelled with `historyNote`.
 *
 * Response: { success, circuitId, urls: { light?, dark? }, version }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) ?? {};
    const { lightDataUrl, darkDataUrl, historyNote } = body;
    const circuitId: unknown =
      typeof body.circuitId === "string"
        ? body.circuitId.toLowerCase()
        : body.circuitId;

    const access = await requireCircuitOwnerOrAdmin(circuitId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }
    const id = circuitId as string;

    if (!lightDataUrl && !darkDataUrl) {
      return NextResponse.json(
        { error: "Missing thumbnail data" },
        { status: 400 },
      );
    }

    if (
      historyNote !== undefined &&
      (typeof historyNote !== "string" ||
        historyNote.length > MAX_HISTORY_NOTE_LENGTH)
    ) {
      return NextResponse.json(
        {
          error: `historyNote must be a string of at most ${MAX_HISTORY_NOTE_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    const images: { theme: ThumbnailTheme; buffer: Buffer }[] = [];
    for (const [theme, dataUrl] of [
      ["light", lightDataUrl],
      ["dark", darkDataUrl],
    ] as const) {
      if (!dataUrl) continue;
      const decoded = decodePngDataUrl(dataUrl);
      if (typeof decoded === "string") {
        return NextResponse.json({ error: decoded }, { status: 400 });
      }
      images.push({ theme, buffer: decoded });
    }

    // Reserve the version before uploading so no two requests share a key
    const reservation = await reserveThumbnailVersion(
      id,
      access.circuit.thumbnail_version,
    );
    if (!reservation.ok) {
      const status = reservation.reason === "not_found" ? 404 : 409;
      return NextResponse.json(
        {
          error:
            reservation.reason === "not_found"
              ? "Circuit not found"
              : reservation.reason === "exhausted"
                ? "Thumbnail version limit reached"
                : "Another thumbnail upload is in progress; please retry",
        },
        { status },
      );
    }
    const version = reservation.version;

    const results: { light?: string; dark?: string } = {};
    for (const { theme, buffer } of images) {
      results[theme] = await uploadThumbnailObject(id, version, theme, buffer);
    }

    // Point the circuit at the new images (thumbnail_version is already N)
    const updateData: {
      thumbnail_light_url?: string;
      thumbnail_dark_url?: string;
    } = {};
    if (results.light) updateData.thumbnail_light_url = results.light;
    if (results.dark) updateData.thumbnail_dark_url = results.dark;

    const { error: dbError } = await createAdminClient()
      .from("circuits")
      .update(updateData)
      .eq("id", id);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return NextResponse.json(
        {
          error: "Uploaded to R2 but failed to update database",
          urls: results,
          version,
        },
        { status: 500 },
      );
    }

    if (results.light && results.dark) {
      // History is an audit trail; failures here don't fail the upload
      const historyError = await recordThumbnailHistory({
        circuitId: id,
        version,
        lightUrl: results.light,
        darkUrl: results.dark,
        regeneratedBy: access.user.id,
        notes: historyNote || null,
      });
      if (historyError) {
        console.warn(
          "Thumbnail history update failed (non-critical):",
          historyError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      circuitId: id,
      urls: results,
      version,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
