import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCircuitOwnerOrAdmin } from "@/lib/api-auth";

// Max decoded size per thumbnail image
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// Initialize R2 client
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

export async function POST(request: NextRequest) {
  try {
    const { circuitId, lightDataUrl, darkDataUrl } = await request.json();

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

    const images: { theme: "light" | "dark"; buffer: Buffer }[] = [];
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

    const r2Client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const publicUrl = process.env.R2_PUBLIC_URL!;

    const results: { light?: string; dark?: string } = {};

    for (const { theme, buffer } of images) {
      const key = `thumbnails/${circuitId}/${theme}.png`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: "image/png",
        }),
      );
      results[theme] = `${publicUrl}/${key}`;
    }

    // Update Supabase database with the new R2 URLs
    const updateData: {
      thumbnail_light_url?: string;
      thumbnail_dark_url?: string;
    } = {};
    if (results.light) updateData.thumbnail_light_url = results.light;
    if (results.dark) updateData.thumbnail_dark_url = results.dark;

    const { error: dbError } = await createAdminClient()
      .from("circuits")
      .update(updateData)
      .eq("id", circuitId);

    if (dbError) {
      console.error("Failed to update Supabase:", dbError);
      return NextResponse.json(
        {
          error: "Uploaded to R2 but failed to update database",
          urls: results,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      circuitId,
      urls: results,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
