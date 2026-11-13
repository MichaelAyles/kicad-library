/**
 * Limits for user-submitted circuits, shared by the upload page (early,
 * friendly checks) and POST /api/circuits (the authoritative checks).
 */

export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 10000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_CATEGORY_LENGTH = 50;
export const MAX_SLUG_LENGTH = 60;

/** Same cap as clipboard output validation: 1MB of schematic text. */
export const MAX_RAW_SEXPR_BYTES = 1024 * 1024;

export const LICENSES = [
  "CERN-OHL-S-2.0",
  "MIT",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "GPL-3.0",
  "Apache-2.0",
  "BSD-2-Clause",
  "TAPR-OHL-1.0",
] as const;

export const SHEET_SIZE_VALUES = ["A4", "A3", "A2"] as const;
