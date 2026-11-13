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
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

// ---------------------------------------------------------------------------
// Thumbnails
//
// Current layout (all new writes): thumbnails/<id>/v<N>-<theme>.png
//   Every version gets its own immutable key, so CDN/browser caches never
//   serve a stale image and thumbnail_history entries stay restorable.
// Legacy layouts still present in the bucket:
//   thumbnails/<id>/<theme>.png       (user uploads before versioning)
//   thumbnails/<id>-v<N>-<theme>.png  (old admin regeneration)
// ---------------------------------------------------------------------------

export type ThumbnailTheme = "light" | "dark";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// The id part is case-insensitive (Postgres accepts either case, and older
// code wrote keys using the id exactly as the client sent it). Parsed ids are
// returned lowercase.
const THUMBNAIL_KEY_RE = new RegExp(
  `^thumbnails/(${UUID_PATTERN})(?:/(?:v(\\d+)-)?|-v(\\d+)-)(light|dark)\\.png$`,
  "i",
);

export interface ParsedThumbnailKey {
  /** Always lowercase. */
  circuitId: string;
  theme: ThumbnailTheme;
  /** Version number, or 0 for the unversioned `thumbnails/<id>/<theme>.png`. */
  version: number;
  layout: "current" | "legacy-fixed" | "legacy-flat";
}

/**
 * Parse a thumbnail object key in any of the known layouts.
 * Returns null for keys that are not circuit thumbnails.
 */
export function parseThumbnailKey(key: string): ParsedThumbnailKey | null {
  const match = THUMBNAIL_KEY_RE.exec(key);
  if (!match) return null;
  const [, rawId, dirVersion, flatVersion, rawTheme] = match;
  const circuitId = rawId.toLowerCase();
  const theme = rawTheme.toLowerCase();
  if (flatVersion !== undefined) {
    return {
      circuitId,
      theme: theme as ThumbnailTheme,
      version: parseInt(flatVersion, 10),
      layout: "legacy-flat",
    };
  }
  return {
    circuitId,
    theme: theme as ThumbnailTheme,
    version: dirVersion !== undefined ? parseInt(dirVersion, 10) : 0,
    layout: dirVersion !== undefined ? "current" : "legacy-fixed",
  };
}

/** R2 key for a versioned thumbnail (the only layout used for new writes). */
export function getThumbnailKey(
  circuitId: string,
  version: number,
  theme: ThumbnailTheme,
): string {
  return `thumbnails/${circuitId.toLowerCase()}/v${version}-${theme}.png`;
}

/** List every key under a prefix, following pagination. */
export async function listKeys(prefix: string): Promise<string[]> {
  const client = getR2Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of listed.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return keys;
}

/**
 * List every thumbnail object for one circuit, in all layouts.
 *
 * The legacy flat layout shares the `thumbnails/<id>-` prefix with nothing
 * else in practice, but keys are still matched exactly against this id so a
 * different circuit's objects can never be returned.
 *
 * R2 prefixes are case-sensitive. New keys are always lowercase; pass
 * `includeUppercase` to also find keys an older client wrote with an
 * uppercase id (used when deleting, where missing a key leaks it forever).
 */
export async function listCircuitThumbnails(
  circuitId: string,
  { includeUppercase = false }: { includeUppercase?: boolean } = {},
): Promise<(ParsedThumbnailKey & { key: string })[]> {
  const id = circuitId.toLowerCase();
  const ids = includeUppercase ? [id, id.toUpperCase()] : [id];
  const listings = await Promise.all(
    ids.flatMap((v) => [
      listKeys(`thumbnails/${v}/`),
      listKeys(`thumbnails/${v}-`),
    ]),
  );
  const results: (ParsedThumbnailKey & { key: string })[] = [];
  for (const key of new Set(listings.flat())) {
    const parsed = parseThumbnailKey(key);
    if (parsed && parsed.circuitId === id) {
      results.push({ ...parsed, key });
    }
  }
  return results;
}

/**
 * Upload one thumbnail image under its versioned key.
 * Versioned keys are never overwritten, so they are cached as immutable.
 *
 * @returns The public URL of the uploaded thumbnail
 */
export async function uploadThumbnailObject(
  circuitId: string,
  version: number,
  theme: ThumbnailTheme,
  body: Buffer,
): Promise<string> {
  const key = getThumbnailKey(circuitId, version, theme);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${getPublicUrl()}/${key}`;
}

/** Delete keys in batches of 1000 (the S3 DeleteObjects limit). */
export async function deleteKeys(
  keys: string[],
): Promise<{ deleted: number; failed: number }> {
  const client = getR2Client();
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    try {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: getBucketName(),
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      const errors = result.Errors?.length ?? 0;
      if (errors > 0) console.error("R2 delete errors:", result.Errors);
      deleted += batch.length - errors;
      failed += errors;
    } catch (error) {
      console.error("R2 delete batch failed:", error);
      failed += batch.length;
    }
  }
  return { deleted, failed };
}

/**
 * Delete every R2 object belonging to a circuit: its schematic and all of
 * its thumbnails, in both the current and legacy key layouts.
 */
export async function deleteCircuitFiles(circuitId: string): Promise<void> {
  const id = circuitId.toLowerCase();
  const thumbnails = await listCircuitThumbnails(id, {
    includeUppercase: true,
  });
  const keys = [getSchematicKey(id), ...thumbnails.map((t) => t.key)];
  const { failed } = await deleteKeys(keys);
  if (failed > 0) {
    throw new Error(
      `Failed to delete ${failed} R2 object(s) for circuit ${circuitId}`,
    );
  }
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
