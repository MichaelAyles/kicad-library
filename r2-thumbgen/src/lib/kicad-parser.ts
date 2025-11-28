/**
 * KiCad S-Expression Parser for R2 Thumbgen
 * Handles wrapping clipboard snippets into full .kicad_sch files
 */

/**
 * Detect if this is a clipboard snippet (partial) or full schematic file
 *
 * Clipboard snippets start with (lib_symbols ...) without (kicad_sch ...)
 * Full files start with (kicad_sch ...)
 */
export function isClipboardSnippet(sexpr: string): boolean {
  const trimmed = sexpr.trim();

  // Check if it starts with (kicad_sch - this is a full file
  if (trimmed.startsWith('(kicad_sch')) {
    return false; // It's a full file
  }

  // If it doesn't start with (kicad_sch, it's a snippet
  // Snippets typically start with (lib_symbols or (symbol
  return true;
}

/**
 * Wrap a clipboard snippet into a complete .kicad_sch file structure
 * This is needed for KiCanvas viewer
 *
 * Based on KiCad 6+ schematic file format specification
 */
export function wrapSnippetToFullFile(snippet: string, options?: {
  title?: string;
  uuid?: string;
}): string {
  const uuid = options?.uuid || `circuit-${Date.now()}`;
  const title = options?.title || 'Circuit Snippet';

  // Create a complete KiCad schematic file structure
  // Version 20231120 is KiCad 8.0 format
  return `(kicad_sch
  (version 20231120)
  (generator "CircuitSnips")
  (generator_version "1.0")

  (uuid "${uuid}")

  (paper "A4")

  (title_block
    (title "${title}")
    (date "${new Date().toISOString().split('T')[0]}")
    (rev "1")
    (company "CircuitSnips")
  )

${snippet}
)`;
}

/**
 * Remove hierarchical sheet instances from schematic
 * This prevents KiCanvas from trying to load non-existent nested sheet files
 *
 * Removes:
 * - (sheet_instances ...) blocks which contain references to other sheets
 * - Individual (sheet ...) elements (hierarchical sheet symbols on schematic)
 */
export function removeHierarchicalSheets(sexpr: string): string {
  // Remove (sheet_instances ...) blocks which contain references to other sheets
  const sheetInstancesRegex = /\(sheet_instances[^)]*(?:\([^)]*\)[^)]*)*\)/g;
  let result = sexpr.replace(sheetInstancesRegex, '');

  // Remove individual (sheet ...) elements (hierarchical sheet symbols on schematic)
  // Match (sheet ... ) including nested parentheses
  const sheetRegex = /\(sheet\s+[^(]*(?:\([^)]*\)[^(]*)*\)/g;
  result = result.replace(sheetRegex, '');

  return result;
}
