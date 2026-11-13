import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCircuitOwnerOrAdmin } from "@/lib/api-auth";
import {
  listCircuitThumbnails,
  uploadThumbnailObject,
  type ThumbnailTheme,
} from "@/lib/r2-schematic";

// Max decoded size per thumbnail image
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
// thumbnail_version is a Postgres INTEGER
const MAX_VERSION = 2147483647;
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
 * Body: { circuitId, lightDataUrl?, darkDataUrl?, version?, historyNote? }
 *
 * Each upload goes to a new immutable key, `thumbnails/<id>/v<N>-<theme>.png`.
 * The server picks N so an existing key is never overwritten: it starts from
 * the requested `version` (or the circuit's thumbnail_version + 1 when
 * omitted) and raises it, if needed, to one above the highest version already
 * stored for the themes being written. The client hint only exists so callers
 * that upload light and dark in two separate requests land on one version.
 *
 * When both themes are sent together, the circuit's thumbnail_version is set
 * to N too, and if `historyNote` is given a thumbnail_history row is recorded
 * for N and marked current.
 *
 * Response: { success, circuitId, urls: { light?, dark? }, version }
 */
export async function POST(request: NextRequest) {
  try {
    const { circuitId, lightDataUrl, darkDataUrl, version, historyNote } =
      await request.json();

    const access = await requireCircuitOwnerOrAdmin(circuitId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (!lightDataUrl && !darkDataUrl) {
      return NextResponse.json(
        { error: "Missing thumbnail data" },
        { status: 400 },
      );
    }

    if (
      version !== undefined &&
      version !== null &&
      !(Number.isInteger(version) && version >= 1 && version <= MAX_VERSION)
    ) {
      return NextResponse.json(
        { error: "version must be a positive integer" },
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
    const isCompleteSet = images.length === 2;

    const adminClient = createAdminClient();

    const { data: circuit, error: circuitError } = await adminClient
      .from("circuits")
      .select("thumbnail_version")
      .eq("id", circuitId)
      .single();
    if (circuitError || !circuit) {
      return NextResponse.json({ error: "Circuit not found" }, { status: 404 });
    }

    // Pick a version whose keys don't exist yet for the themes being written
    // and that thumbnail_history hasn't used. Only stored keys of the themes
    // in this request count, so a light-then-dark pair of single-theme
    // requests resolves to the same version for both.
    const themes = new Set(images.map((i) => i.theme));
    const stored = await listCircuitThumbnails(circuitId);
    const { data: latestHistory } = await adminClient
      .from("thumbnail_history")
      .select("version")
      .eq("circuit_id", circuitId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const highestStored = Math.max(
      latestHistory?.version ?? 0,
      ...stored.filter((t) => themes.has(t.theme)).map((t) => t.version),
    );
    const requested: number =
      typeof version === "number"
        ? version
        : (circuit.thumbnail_version ?? 0) + 1;
    const newVersion = Math.max(requested, highestStored + 1);

    const results: { light?: string; dark?: string } = {};
    for (const { theme, buffer } of images) {
      results[theme] = await uploadThumbnailObject(
        circuitId,
        newVersion,
        theme,
        buffer,
      );
    }

    // Point the circuit at the new images. thumbnail_version is only set for
    // a complete light+dark pair; single-theme callers set it themselves.
    const updateData: {
      thumbnail_light_url?: string;
      thumbnail_dark_url?: string;
      thumbnail_version?: number;
    } = {};
    if (results.light) updateData.thumbnail_light_url = results.light;
    if (results.dark) updateData.thumbnail_dark_url = results.dark;
    if (isCompleteSet) updateData.thumbnail_version = newVersion;

    const { error: dbError } = await adminClient
      .from("circuits")
      .update(updateData)
      .eq("id", circuitId);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return NextResponse.json(
        {
          error: "Uploaded to R2 but failed to update database",
          urls: results,
          version: newVersion,
        },
        { status: 500 },
      );
    }

    if (isCompleteSet && historyNote !== undefined) {
      // History is an audit trail; failures here don't fail the upload
      const { error: clearError } = await adminClient
        .from("thumbnail_history")
        .update({ is_current: false })
        .eq("circuit_id", circuitId)
        .eq("is_current", true);
      const { error: historyError } = await adminClient
        .from("thumbnail_history")
        .upsert(
          {
            circuit_id: circuitId,
            version: newVersion,
            thumbnail_light_url: results.light,
            thumbnail_dark_url: results.dark,
            regenerated_by: access.user.id,
            regenerated_at: new Date().toISOString(),
            is_current: true,
            notes: historyNote || null,
          },
          { onConflict: "circuit_id,version" },
        );
      if (clearError || historyError) {
        console.warn(
          "Thumbnail history update failed (non-critical):",
          clearError ?? historyError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      circuitId,
      urls: results,
      version: newVersion,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
