/**
 * R2 key layout and schematic processing, shared by the Next routes
 * (r2-schematic.ts, AWS SDK) and the API worker (R2 binding).
 *
 * Pure functions only: no storage client, no environment access.
 */

import {
  isClipboardSnippet,
  wrapSnippetToFullFile,
  replacePaperSize,
  removeHierarchicalSheets,
  validateSExpression,
  selectSheetSize,
  type SheetSize,
} from "@/lib/kicad-parser";

/** Cache-Control for every object we write: keys are never reused. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const SCHEMATIC_CONTENT_TYPE = "text/plain; charset=utf-8";
export const THUMBNAIL_CONTENT_TYPE = "image/png";

/**
 * Get the R2 key for a circuit's schematic
 */
export function getSchematicKey(circuitId: string): string {
  return `schematics/${circuitId}.kicad_sch`;
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

export type CircuitThumbnailObject = ParsedThumbnailKey & { key: string };

/**
 * List every thumbnail object for one circuit, in all layouts, using the
 * given prefix lister (AWS SDK or R2 binding).
 *
 * The legacy flat layout shares the `thumbnails/<id>-` prefix with nothing
 * else in practice, but keys are still matched exactly against this id so a
 * different circuit's objects can never be returned.
 *
 * R2 prefixes are case-sensitive. New keys are always lowercase; pass
 * `includeUppercase` to also find keys an older client wrote with an
 * uppercase id (used when deleting, where missing a key leaks it forever).
 */
export async function listCircuitThumbnailsWith(
  listKeys: (prefix: string) => Promise<string[]>,
  circuitId: string,
  { includeUppercase = false }: { includeUppercase?: boolean } = {},
): Promise<CircuitThumbnailObject[]> {
  const id = circuitId.toLowerCase();
  const ids = includeUppercase ? [id, id.toUpperCase()] : [id];
  const listings = await Promise.all(
    ids.flatMap((v) => [
      listKeys(`thumbnails/${v}/`),
      listKeys(`thumbnails/${v}-`),
    ]),
  );
  const results: CircuitThumbnailObject[] = [];
  for (const key of new Set(listings.flat())) {
    const parsed = parseThumbnailKey(key);
    if (parsed && parsed.circuitId === id) {
      results.push({ ...parsed, key });
    }
  }
  return results;
}
