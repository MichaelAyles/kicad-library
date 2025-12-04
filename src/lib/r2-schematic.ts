/**
 * R2 Storage utilities for circuit schematics
 *
 * Handles uploading processed schematics (KiCanvas-ready .kicad_sch files) to R2.
 * Unlike raw_sexpr which stores the original snippet/file, this stores the
 * fully processed version that KiCanvas can load directly.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  isClipboardSnippet,
  wrapSnippetToFullFile,
  replacePaperSize,
  removeHierarchicalSheets,
  validateSExpression,
  selectSheetSize,
  type SheetSize,
} from "@/lib/kicad-parser";

// Lazy-initialized R2 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

function getBucketName(): string {
  return process.env.R2_BUCKET_NAME!;
}

function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL!;
}

/**
 * Get the R2 key for a circuit's schematic
 */
export function getSchematicKey(circuitId: string): string {
  return `schematics/${circuitId}.kicad_sch`;
}

/**
 * Get the public URL for a circuit's schematic
 */
export function getSchematicR2Url(circuitId: string): string {
  return `${getPublicUrl()}/${getSchematicKey(circuitId)}`;
}

export interface ProcessSchematicOptions {
  circuitId: string;
  rawSexpr: string;
  title: string;
  sheetSizeOverride?: SheetSize | null;
}

/**
 * Process a raw schematic (snippet or full file) into KiCanvas-ready format
 *
 * This applies:
 * 1. Paper size (from override or auto-detected)
 * 2. Snippet wrapping (if needed)
 * 3. Hierarchical sheet removal
 */
export function processSchematicForR2(
  options: ProcessSchematicOptions,
): string {
  const { circuitId, rawSexpr, title, sheetSizeOverride } = options;

  // 1. Determine paper size
  let paperSize: SheetSize = "A4";
  if (sheetSizeOverride) {
    paperSize = sheetSizeOverride;
  } else {
    const validation = validateSExpression(rawSexpr);
    if (validation.valid && validation.metadata) {
      paperSize = selectSheetSize(validation.metadata.boundingBox).size;
    }
  }

  // 2. Wrap if snippet, or replace paper size if full file
  let processed: string;
  if (isClipboardSnippet(rawSexpr)) {
    processed = wrapSnippetToFullFile(rawSexpr, {
      title,
      uuid: circuitId,
      paperSize,
    });
  } else {
    processed = replacePaperSize(rawSexpr, paperSize);
  }

  // 3. Remove hierarchical sheet references
  processed = removeHierarchicalSheets(processed);

  return processed;
}

/**
 * Upload a processed schematic to R2
 *
 * @returns The public URL of the uploaded schematic
 */
export async function uploadSchematic(
  circuitId: string,
  processedSchematic: string,
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = getSchematicKey(circuitId);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: processedSchematic,
    ContentType: "text/plain; charset=utf-8",
    CacheControl: "public, max-age=31536000, immutable",
  });

  await client.send(command);

  return `${getPublicUrl()}/${key}`;
}

/**
 * Process and upload a schematic to R2 in one step
 *
 * @returns The public URL of the uploaded schematic
 */
export async function processAndUploadSchematic(
  options: ProcessSchematicOptions,
): Promise<string> {
  const processed = processSchematicForR2(options);
  return uploadSchematic(options.circuitId, processed);
}

/**
 * Delete a schematic from R2
 */
export async function deleteSchematic(circuitId: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = getSchematicKey(circuitId);

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if a schematic exists in R2
 */
export async function schematicExists(circuitId: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = getSchematicKey(circuitId);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}
