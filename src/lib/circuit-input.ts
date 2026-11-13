/**
 * Server-side input validation for creating circuits (POST /api/circuits).
 * Kept out of circuit-limits.ts so zod stays out of the upload page bundle.
 */

import { z } from "zod";
import { generateSlug } from "@/lib/kicad-parser";
import {
  LICENSES,
  MAX_CATEGORY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_RAW_SEXPR_BYTES,
  MAX_SLUG_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_TITLE_LENGTH,
  SHEET_SIZE_VALUES,
} from "@/lib/circuit-limits";

/**
 * Accepted fields only. `.strict()` rejects anything else (user_id, counters,
 * batch_import_id, schematic_r2_url, thumbnail URLs, ...) instead of silently
 * ignoring it. Those columns are set by the server or by later steps.
 */
export const CreateCircuitSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(MAX_TITLE_LENGTH),
    description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).default(""),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(MAX_TAG_LENGTH))
      .min(1, "At least one tag is required")
      .max(MAX_TAGS)
      .transform((tags) => Array.from(new Set(tags))),
    category: z
      .string()
      .trim()
      .min(1)
      .max(MAX_CATEGORY_LENGTH)
      .nullable()
      .default(null),
    license: z.enum(LICENSES),
    is_public: z.boolean().default(true),
    sheet_size: z.enum(SHEET_SIZE_VALUES).nullable().default(null),
    raw_sexpr: z
      .string()
      .min(1, "raw_sexpr is required")
      .refine(
        (s) => Buffer.byteLength(s, "utf8") <= MAX_RAW_SEXPR_BYTES,
        `raw_sexpr must be at most ${MAX_RAW_SEXPR_BYTES / 1024 / 1024}MB`,
      ),
    /** Preferred slug; normalized and made unique by the server. */
    slug: z.string().max(200).optional(),
  })
  .strict();

export type CreateCircuitInput = z.infer<typeof CreateCircuitSchema>;

/** Lowercase, [a-z0-9-] only, no leading/trailing hyphens, length-capped. */
export function normalizeSlug(value: string): string {
  return generateSlug(value)
    .replace(/^-+|-+$/g, "")
    .substring(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/** Slug to start from: the requested one, else the title, else "circuit". */
export function baseSlugFor(input: { slug?: string; title: string }): string {
  return (
    normalizeSlug(input.slug ?? "") || normalizeSlug(input.title) || "circuit"
  );
}
