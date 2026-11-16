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
  IMMUTABLE_CACHE_CONTROL,
  SCHEMATIC_CONTENT_TYPE,
  THUMBNAIL_CONTENT_TYPE,
  getSchematicKey,
  getThumbnailKey,
  parseThumbnailKey,
  listCircuitThumbnailsWith,
  processSchematicForR2,
  type CircuitThumbnailObject,
  type ParsedThumbnailKey,
  type ProcessSchematicOptions,
  type ThumbnailTheme,
} from "@/lib/r2-keys";

// Re-exported so existing imports from this module keep working
export {
  getSchematicKey,
  getThumbnailKey,
  parseThumbnailKey,
  processSchematicForR2,
  type ParsedThumbnailKey,
  type ProcessSchematicOptions,
  type ThumbnailTheme,
};

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
 * Get the public URL for a circuit's schematic
 */
export function getSchematicR2Url(circuitId: string): string {
  return `${getPublicUrl()}/${getSchematicKey(circuitId)}`;
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
    ContentType: SCHEMATIC_CONTENT_TYPE,
    CacheControl: IMMUTABLE_CACHE_CONTROL,
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

/** List every thumbnail object for one circuit, in all layouts. */
export function listCircuitThumbnails(
  circuitId: string,
  options: { includeUppercase?: boolean } = {},
): Promise<CircuitThumbnailObject[]> {
  return listCircuitThumbnailsWith(listKeys, circuitId, options);
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
      ContentType: THUMBNAIL_CONTENT_TYPE,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
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
