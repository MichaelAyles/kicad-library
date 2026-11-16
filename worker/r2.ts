/**
 * Circuit files in R2 via the SCHEMATICS_BUCKET binding (no access keys).
 *
 * Port of src/lib/r2-schematic.ts: same keys, content types, cache headers
 * and public URLs (`${R2_PUBLIC_URL}/<key>`). Key layout and schematic
 * processing are shared through src/lib/r2-keys.ts.
 */

import {
  IMMUTABLE_CACHE_CONTROL,
  SCHEMATIC_CONTENT_TYPE,
  THUMBNAIL_CONTENT_TYPE,
  getSchematicKey,
  getThumbnailKey,
  listCircuitThumbnailsWith,
  processSchematicForR2,
  type CircuitThumbnailObject,
  type ProcessSchematicOptions,
  type ThumbnailTheme,
} from "../src/lib/r2-keys";
import type { Env } from "./env";

/** R2's per-call limit for both `delete(keys[])` and `list()`. */
const R2_BATCH = 1000;

export interface CircuitStorage {
  publicUrl(key: string): string;
  uploadSchematic(circuitId: string, processed: string): Promise<string>;
  processAndUploadSchematic(options: ProcessSchematicOptions): Promise<string>;
  deleteSchematic(circuitId: string): Promise<void>;
  schematicExists(circuitId: string): Promise<boolean>;
  listKeys(prefix: string): Promise<string[]>;
  listCircuitThumbnails(
    circuitId: string,
    options?: { includeUppercase?: boolean },
  ): Promise<CircuitThumbnailObject[]>;
  uploadThumbnailObject(
    circuitId: string,
    version: number,
    theme: ThumbnailTheme,
    body: ArrayBufferView | ArrayBuffer,
  ): Promise<string>;
  deleteKeys(keys: string[]): Promise<{ deleted: number; failed: number }>;
  deleteCircuitFiles(circuitId: string): Promise<void>;
}

export function createCircuitStorage(
  env: Pick<Env, "SCHEMATICS_BUCKET" | "R2_PUBLIC_URL">,
): CircuitStorage {
  const bucket = env.SCHEMATICS_BUCKET;
  const publicUrl = (key: string) => `${env.R2_PUBLIC_URL}/${key}`;

  async function listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const listed = await bucket.list({ prefix, cursor, limit: R2_BATCH });
      for (const obj of listed.objects) keys.push(obj.key);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return keys;
  }

  async function deleteKeys(
    keys: string[],
  ): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    for (let i = 0; i < keys.length; i += R2_BATCH) {
      const batch = keys.slice(i, i + R2_BATCH);
      try {
        // All-or-nothing per call; deleting a missing key is not an error
        await bucket.delete(batch);
        deleted += batch.length;
      } catch (error) {
        console.error("R2 delete batch failed:", error);
        failed += batch.length;
      }
    }
    return { deleted, failed };
  }

  const listCircuitThumbnails: CircuitStorage["listCircuitThumbnails"] = (
    circuitId,
    options,
  ) => listCircuitThumbnailsWith(listKeys, circuitId, options);

  async function uploadSchematic(
    circuitId: string,
    processed: string,
  ): Promise<string> {
    const key = getSchematicKey(circuitId);
    await bucket.put(key, processed, {
      httpMetadata: {
        contentType: SCHEMATIC_CONTENT_TYPE,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      },
    });
    return publicUrl(key);
  }

  return {
    publicUrl,
    listKeys,
    deleteKeys,
    listCircuitThumbnails,
    uploadSchematic,

    processAndUploadSchematic(options) {
      return uploadSchematic(options.circuitId, processSchematicForR2(options));
    },

    async deleteSchematic(circuitId) {
      await bucket.delete(getSchematicKey(circuitId));
    },

    async schematicExists(circuitId) {
      try {
        return (await bucket.head(getSchematicKey(circuitId))) !== null;
      } catch {
        return false;
      }
    },

    async uploadThumbnailObject(circuitId, version, theme, body) {
      const key = getThumbnailKey(circuitId, version, theme);
      await bucket.put(key, body, {
        httpMetadata: {
          contentType: THUMBNAIL_CONTENT_TYPE,
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        },
      });
      return publicUrl(key);
    },

    /**
     * Delete every R2 object belonging to a circuit: its schematic and all of
     * its thumbnails, in both the current and legacy key layouts.
     */
    async deleteCircuitFiles(circuitId) {
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
    },
  };
}
