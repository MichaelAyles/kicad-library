/**
 * Validation for Batch Import Records
 *
 * Validates incoming data from scraper before importing to CircuitSnips
 */

export interface ImportRecord {
  source_file_id: string;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  repo_license: string;
  file_path: string;
  raw_sexpr: string;
  component_count: number;
  classification_score: number;
  subcircuit: {
    name: string;
    description: string;
    components?: string;
    useCase?: string;
    notes?: string;
    tags: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single import record
 *
 * Checks:
 * - Required fields present
 * - Field types correct
 * - Field lengths within limits
 * - S-expression valid
 * - Tags properly formatted
 */
export function validateImportRecord(record: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required top-level fields
  if (!record.source_file_id) errors.push("Missing source_file_id");
  if (!record.repo_owner) errors.push("Missing repo_owner");
  if (!record.repo_name) errors.push("Missing repo_name");
  if (!record.repo_url) errors.push("Missing repo_url");
  if (!record.repo_license) errors.push("Missing repo_license");
  if (!record.file_path) errors.push("Missing file_path");
  if (!record.raw_sexpr) errors.push("Missing raw_sexpr");
  if (record.component_count === undefined)
    errors.push("Missing component_count");
  if (record.classification_score === undefined)
    errors.push("Missing classification_score");

  // Validate types
  if (typeof record.source_file_id !== "string") {
    errors.push("source_file_id must be a string");
  }
  if (typeof record.repo_owner !== "string") {
    errors.push("repo_owner must be a string");
  }
  if (typeof record.repo_name !== "string") {
    errors.push("repo_name must be a string");
  }
  if (typeof record.repo_url !== "string") {
    errors.push("repo_url must be a string");
  } else if (!isValidUrl(record.repo_url)) {
    errors.push("repo_url must be a valid URL");
  }
  if (typeof record.raw_sexpr !== "string") {
    errors.push("raw_sexpr must be a string");
  }
  if (typeof record.component_count !== "number") {
    errors.push("component_count must be a number");
  }
  if (typeof record.classification_score !== "number") {
    errors.push("classification_score must be a number");
  }

  // Validate subcircuit object
  if (!record.subcircuit) {
    errors.push("Missing subcircuit object");
  } else {
    const sc = record.subcircuit;

    if (!sc.name) errors.push("Missing subcircuit.name");
    if (!sc.description) errors.push("Missing subcircuit.description");
    if (!sc.tags) errors.push("Missing subcircuit.tags");

    // Validate subcircuit types
    if (typeof sc.name !== "string") {
      errors.push("subcircuit.name must be a string");
    } else if (sc.name.length > 100) {
      errors.push("subcircuit.name must be 100 characters or less");
    }

    if (typeof sc.description !== "string") {
      errors.push("subcircuit.description must be a string");
    } else if (sc.description.length > 2000) {
      warnings.push(
        "subcircuit.description is very long (>2000 chars), will be truncated",
      );
    }

    // Validate tags array
    if (!Array.isArray(sc.tags)) {
      errors.push("subcircuit.tags must be an array");
    } else {
      if (sc.tags.length === 0) {
        errors.push("subcircuit.tags must have at least one tag");
      }
      if (sc.tags.length > 10) {
        warnings.push(
          "subcircuit.tags has more than 10 tags, extras will be ignored",
        );
      }

      // Validate each tag
      sc.tags.forEach((tag: any, index: number) => {
        if (typeof tag !== "string") {
          errors.push(`subcircuit.tags[${index}] must be a string`);
        } else if (tag.length > 30) {
          errors.push(`subcircuit.tags[${index}] exceeds 30 characters`);
        } else if (tag.trim().length === 0) {
          errors.push(`subcircuit.tags[${index}] is empty`);
        }
      });
    }
  }

  // Validate S-expression has basic structure
  if (record.raw_sexpr && typeof record.raw_sexpr === "string") {
    const trimmed = record.raw_sexpr.trim();
    if (!trimmed.startsWith("(")) {
      errors.push("raw_sexpr must start with opening parenthesis");
    }
    if (!trimmed.endsWith(")")) {
      errors.push("raw_sexpr must end with closing parenthesis");
    }
    if (trimmed.length < 100) {
      warnings.push(
        "raw_sexpr seems very short, may not be a complete schematic",
      );
    }
  }

  // Validate classification score range
  if (typeof record.classification_score === "number") {
    if (record.classification_score < 0 || record.classification_score > 10) {
      errors.push("classification_score must be between 0 and 10");
    }
    if (record.classification_score < 7) {
      warnings.push("classification_score is below recommended threshold of 7");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an array of import records
 *
 * @param records - Array of records to validate
 * @returns Array of validation results (same order as input)
 */
export function validateImportBatch(records: any[]): ValidationResult[] {
  if (!Array.isArray(records)) {
    throw new Error("Records must be an array");
  }

  if (records.length === 0) {
    throw new Error("Records array is empty");
  }

  if (records.length > 100) {
    throw new Error("Batch size exceeds maximum of 100 records");
  }

  return records.map(validateImportRecord);
}

/**
 * Simple URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if license is supported by CircuitSnips
 * Returns the normalized license identifier
 */
export function normalizeLicense(license: string): string | null {
  // Supported licenses in CircuitSnips
  // User uploads are limited to OSHW-compliant licenses
  // GitHub imports can use additional common open source licenses
  const supportedLicenses = [
    // OSHW-compliant (for user uploads)
    "MIT",
    "Apache-2.0",
    "GPL-3.0",
    "BSD-2-Clause",
    "CC-BY-4.0",
    "CC-BY-SA-4.0",
    "CERN-OHL-S-2.0",
    "CERN-OHL-W-2.0",
    "CERN-OHL-P-2.0",
    "CERN-OHL-1.2",
    "TAPR-OHL-1.0",
    // Common GitHub licenses (imports only)
    "CC-BY-NC-SA-4.0",
    "CC-BY-NC-SA-3.0",
    "CC-BY-NC-4.0",
    "CC-BY-NC-3.0",
    "CC-BY-ND-4.0",
    "CC0-1.0",
    "Unlicense",
    "GPL-2.0",
    "LGPL-2.1",
    "LGPL-3.0",
    "AGPL-3.0",
    "MPL-2.0",
    "BSD-3-Clause",
    "ISC",
  ];

  // Normalize input (trim, uppercase for comparison)
  const normalized = license.trim();

  // Check for exact match (case-insensitive)
  const match = supportedLicenses.find(
    (supported) => supported.toLowerCase() === normalized.toLowerCase(),
  );

  if (match) {
    return match;
  }

  // Handle common variations
  const variations: Record<string, string> = {
    "apache-2": "Apache-2.0",
    apache: "Apache-2.0",
    "gpl-3": "GPL-3.0",
    gpl3: "GPL-3.0",
    "gpl-2": "GPL-2.0",
    gpl2: "GPL-2.0",
    "lgpl-2.1": "LGPL-2.1",
    "lgpl-3": "LGPL-3.0",
    "lgpl-3.0": "LGPL-3.0",
    "agpl-3": "AGPL-3.0",
    "agpl-3.0": "AGPL-3.0",
    "bsd-2": "BSD-2-Clause",
    bsd2: "BSD-2-Clause",
    "bsd-3": "BSD-3-Clause",
    bsd3: "BSD-3-Clause",
    "cc-by": "CC-BY-4.0",
    "cc-by-sa": "CC-BY-SA-4.0",
    "cc-by-nc-sa": "CC-BY-NC-SA-4.0",
    "cc by nc sa 4.0": "CC-BY-NC-SA-4.0",
    "cc-by-nc-sa-3.0": "CC-BY-NC-SA-3.0",
    "cc by nc sa 3.0": "CC-BY-NC-SA-3.0",
    "cc-by-nc": "CC-BY-NC-4.0",
    "cc-by-nc-3.0": "CC-BY-NC-3.0",
    "cc by nc 3.0": "CC-BY-NC-3.0",
    "cc-by-nd": "CC-BY-ND-4.0",
    cc0: "CC0-1.0",
    "cern-ohl-s": "CERN-OHL-S-2.0",
    "cern-ohl-w": "CERN-OHL-W-2.0",
    "cern-ohl-p": "CERN-OHL-P-2.0",
    "cern-ohl": "CERN-OHL-S-2.0",
    tapr: "TAPR-OHL-1.0",
    "mpl-2": "MPL-2.0",
    mpl: "MPL-2.0",
  };

  const variation = variations[normalized.toLowerCase()];
  if (variation) {
    return variation;
  }

  // Unknown license - return null
  return null;
}
