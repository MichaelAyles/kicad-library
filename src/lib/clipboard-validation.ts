/**
 * Clipboard Output Validation
 *
 * Validates schematic data before copying to clipboard to prevent:
 * - Excessively large output that could crash KiCad
 * - Malformed S-expressions that could corrupt projects
 * - Missing required elements that would make invalid snippets
 */

export interface ClipboardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    size: number;
    lineCount: number;
    libSymbolCount: number;
    symbolCount: number;
    wireCount: number;
    labelCount: number;
  };
}

// Maximum safe sizes
const MAX_CLIPBOARD_SIZE = 1024 * 1024; // 1MB - anything larger is suspicious
const WARN_CLIPBOARD_SIZE = 512 * 1024; // 512KB - warn user about large data
const MAX_LINES = 50000; // 50k lines should be more than enough for any schematic

/**
 * Valid top-level elements in a KiCad schematic clipboard snippet
 */
const VALID_SNIPPET_ELEMENTS = new Set([
  "lib_symbols",
  "symbol",
  "wire",
  "bus",
  "bus_entry",
  "polyline",
  "rectangle",
  "circle",
  "arc",
  "text",
  "label",
  "global_label",
  "hierarchical_label",
  "netclass_flag",
  "junction",
  "no_connect",
  "sheet",
  "sheet_instances",
  "symbol_instances",
]);

/**
 * Validate clipboard data before copying
 */
export function validateClipboardData(data: string): ClipboardValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks
  const size = new Blob([data]).size;
  const lineCount = data.split("\n").length;

  if (size > MAX_CLIPBOARD_SIZE) {
    errors.push(
      `Data too large (${formatSize(size)}). Maximum allowed is ${formatSize(MAX_CLIPBOARD_SIZE)}.`,
    );
  } else if (size > WARN_CLIPBOARD_SIZE) {
    warnings.push(
      `Large data size (${formatSize(size)}). This may take time to paste in KiCad.`,
    );
  }

  if (lineCount > MAX_LINES) {
    errors.push(
      `Too many lines (${lineCount}). Maximum allowed is ${MAX_LINES}.`,
    );
  }

  // Check for binary/non-printable characters (except common whitespace)
  const binaryCheck = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
  if (binaryCheck.test(data)) {
    errors.push("Data contains binary or non-printable characters.");
  }

  // Count elements
  const stats = countElements(data);

  // Validate structure
  const structureValidation = validateStructure(data);
  errors.push(...structureValidation.errors);
  warnings.push(...structureValidation.warnings);

  // Check for suspicious patterns
  const suspiciousPatterns = checkSuspiciousPatterns(data);
  warnings.push(...suspiciousPatterns);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      size,
      lineCount,
      ...stats,
    },
  };
}

/**
 * Count schematic elements in the data
 */
function countElements(data: string): {
  libSymbolCount: number;
  symbolCount: number;
  wireCount: number;
  labelCount: number;
} {
  // Count top-level elements (not nested ones)
  const libSymbolCount = (data.match(/^\s*\(lib_symbols\b/gm) || []).length;
  // Symbol count: match (symbol at start of line that's NOT inside lib_symbols
  // This is approximate - we look for symbol followed by lib_id or at position
  const symbolCount = (data.match(/^\s*\(symbol\s+\(/gm) || []).length;
  const wireCount = (data.match(/^\s*\(wire\b/gm) || []).length;
  const labelCount = (
    data.match(/^\s*\((label|global_label|hierarchical_label)\b/gm) || []
  ).length;

  return {
    libSymbolCount,
    symbolCount,
    wireCount,
    labelCount,
  };
}

/**
 * Validate S-expression structure
 */
function validateStructure(data: string): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check parentheses balance
  let parenCount = 0;
  let inString = false;

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const prevChar = i > 0 ? data[i - 1] : "";

    // Track string boundaries
    if (char === '"' && prevChar !== "\\") {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;

      // Early exit if unbalanced
      if (parenCount < 0) {
        errors.push(
          `Unbalanced parentheses: found closing ')' without matching '(' at position ${i}`,
        );
        break;
      }
    }
  }

  if (parenCount > 0) {
    errors.push(`Unbalanced parentheses: ${parenCount} unclosed '(' found`);
  }

  // Check for required elements - a valid snippet should have lib_symbols if it has symbols
  const hasLibSymbols = data.includes("(lib_symbols");
  const hasSymbols = /\(symbol\s+\(lib_id/.test(data);

  if (hasSymbols && !hasLibSymbols) {
    warnings.push(
      "Snippet has symbol instances but no lib_symbols definitions. KiCad may not be able to display symbols correctly.",
    );
  }

  // Check for unexpectedly empty lib_symbols
  const emptyLibSymbols = /\(lib_symbols\s*\)/.test(data);
  if (emptyLibSymbols && hasSymbols) {
    warnings.push(
      "lib_symbols section is empty but symbols are present. This may cause rendering issues.",
    );
  }

  return { errors, warnings };
}

/**
 * Check for suspicious patterns that might indicate corruption
 */
function checkSuspiciousPatterns(data: string): string[] {
  const warnings: string[] = [];

  // Check for suspiciously low characters per line (indicates broken formatting)
  // Normal KiCad files have 30-50+ chars per line; broken nodeToString output has ~12
  const lines = data.split("\n");
  const avgCharsPerLine = data.length / lines.length;
  if (avgCharsPerLine < 20 && lines.length > 100) {
    warnings.push(
      `Suspiciously low characters per line (${avgCharsPerLine.toFixed(1)} avg). Data may have corrupted formatting.`,
    );
  }

  // Check for excessive whitespace (could indicate nodeToString bug)
  const maxConsecutiveSpaces = 100;
  const spacePattern = new RegExp(` {${maxConsecutiveSpaces},}`);
  if (spacePattern.test(data)) {
    warnings.push(
      "Data contains excessive whitespace which may indicate corruption.",
    );
  }

  // Check for excessive newlines
  const maxConsecutiveNewlines = 10;
  const newlinePattern = new RegExp(`\n{${maxConsecutiveNewlines},}`);
  if (newlinePattern.test(data)) {
    warnings.push(
      "Data contains excessive blank lines which may indicate corruption.",
    );
  }

  // Check for repeated long strings (potential infinite loop artifact)
  const longStringPattern = /(.{50,})\1{3,}/;
  if (longStringPattern.test(data)) {
    warnings.push(
      "Data contains suspiciously repeated content which may indicate corruption.",
    );
  }

  // Check for null bytes or other binary artifacts
  if (data.includes("\0")) {
    warnings.push("Data contains null bytes which is invalid in S-expressions.");
  }

  // Check for symbols without any connections (suspicious for non-trivial schematics)
  const symbolCount = (data.match(/^\s*\(symbol\s+\(/gm) || []).length;
  const wireCount = (data.match(/^\s*\(wire\b/gm) || []).length;
  if (symbolCount > 10 && wireCount === 0) {
    warnings.push(
      `Schematic has ${symbolCount} symbols but no wires. Elements may not have been extracted properly.`,
    );
  }

  return warnings;
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sanitize clipboard data by removing problematic content
 * Only call this if validation found warnings but no errors
 */
export function sanitizeClipboardData(data: string): string {
  let result = data;

  // Normalize excessive whitespace (but preserve structure)
  result = result.replace(/ {4,}/g, "  "); // Reduce long space runs to 2 spaces
  result = result.replace(/\n{3,}/g, "\n\n"); // Reduce multiple blank lines to 1

  // Remove any stray null bytes or other control characters
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  return result;
}
