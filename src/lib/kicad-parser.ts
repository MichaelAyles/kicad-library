/**
 * Unified KiCad S-Expression Parser
 *
 * Handles both clipboard snippets and full .kicad_sch files
 *
 * Format Types:
 * - Clipboard snippet: Raw (lib_symbols ...) and (symbol ...) data from KiCad copy
 * - Full file: Complete (kicad_sch ...) structure with headers
 *
 * Use Cases:
 * - Upload: Accept either format, store as-is
 * - Preview: Always render as full file (wrap snippets automatically)
 * - Copy: Always provide snippet only (extract from full files)
 * - Download: Always provide full file with attribution (wrap snippets)
 */

export interface SExprNode {
  type: "list" | "atom" | "string";
  value?: string;
  children?: SExprNode[];
}

export interface Component {
  reference: string; // "R1", "U2"
  value: string; // "10k", "LM358"
  footprint: string; // "Resistor_SMD:R_0805_2012Metric"
  lib_id: string; // "Device:R"
  uuid: string;
  position: {
    x: number;
    y: number;
    angle?: number;
  };
  properties?: Record<string, string>;
}

export interface Net {
  name: string;
  type: "label" | "global_label" | "hierarchical_label";
}

export interface ParsedMetadata {
  components: Component[];
  uniqueComponents: Array<{
    lib_id: string;
    count: number;
    values: string[];
  }>;
  nets: Net[];
  stats: {
    componentCount: number;
    wireCount: number;
    netCount: number;
  };
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  footprints: {
    assigned: number;
    unassigned: number;
    types: string[];
  };
  version: string;
  warnings?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: ParsedMetadata;
  isSnippet: boolean; // True if clipboard snippet, false if full file
  originalFormat: "snippet" | "full";
}

// ============================================================================
// SHEET SIZE SELECTION
// ============================================================================

/**
 * Standard paper sizes with usable area dimensions (in mm)
 * Based on KiCad's internal coordinate system with margins
 *
 * Measured from actual KiCad schematics:
 * - A4: usable area from (12.7, 12.7) to (283.21, 196.85)
 * - A3: usable area from (12.7, 12.7) to (406.4, 284.48)
 * - A2: 594x420mm paper, estimated usable ~570x396mm
 */
export const SHEET_SIZES = {
  A4: { width: 270, height: 184, name: "A4" as const },
  A3: { width: 394, height: 272, name: "A3" as const },
  A2: { width: 570, height: 396, name: "A2" as const },
} as const;

export type SheetSize = "A4" | "A3" | "A2";

export interface SheetSizeResult {
  size: SheetSize;
  recommended: SheetSize;
  isOversized: boolean;
  boundingBox: { width: number; height: number };
}

/**
 * Select the appropriate sheet size based on bounding box dimensions
 *
 * @param boundingBox - The min/max coordinates of the schematic content
 * @returns Sheet size selection result with recommendation and oversized flag
 */
export function selectSheetSize(boundingBox: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): SheetSizeResult {
  const width = boundingBox.maxX - boundingBox.minX;
  const height = boundingBox.maxY - boundingBox.minY;

  // Check if fits in A4
  if (width <= SHEET_SIZES.A4.width && height <= SHEET_SIZES.A4.height) {
    return {
      size: "A4",
      recommended: "A4",
      isOversized: false,
      boundingBox: { width, height },
    };
  }

  // Check if fits in A3
  if (width <= SHEET_SIZES.A3.width && height <= SHEET_SIZES.A3.height) {
    return {
      size: "A3",
      recommended: "A3",
      isOversized: false,
      boundingBox: { width, height },
    };
  }

  // Check if fits in A2
  if (width <= SHEET_SIZES.A2.width && height <= SHEET_SIZES.A2.height) {
    return {
      size: "A2",
      recommended: "A2",
      isOversized: false,
      boundingBox: { width, height },
    };
  }

  // Too large - use A2 but flag as oversized
  return {
    size: "A2",
    recommended: "A2",
    isOversized: true,
    boundingBox: { width, height },
  };
}

// ============================================================================
// DETECTION: Identify format type
// ============================================================================

/**
 * Detect if this is a clipboard snippet (partial) or full schematic file
 *
 * Clipboard snippets start with (lib_symbols ...) without (kicad_sch ...)
 * Full files start with (kicad_sch ...)
 */
export function isClipboardSnippet(sexpr: string): boolean {
  const trimmed = sexpr.trim();

  // Check if it has kicad_sch wrapper
  if (trimmed.includes("(kicad_sch")) {
    return false; // It's a full file
  }

  // Check if it has lib_symbols or symbol (clipboard data)
  if (trimmed.startsWith("(lib_symbols") || trimmed.includes("(lib_symbols")) {
    return true; // It's a snippet
  }

  // If it has symbols but no kicad_sch, treat as snippet
  if (trimmed.includes("(symbol")) {
    return true;
  }

  return false;
}

// ============================================================================
// WRAPPING: Convert between formats
// ============================================================================

/**
 * Wrap a clipboard snippet into a complete .kicad_sch file structure
 * This is needed for KiCanvas viewer and for downloads
 *
 * Based on KiCad 6+ schematic file format specification
 */
export function wrapSnippetToFullFile(
  snippet: string,
  options?: {
    title?: string;
    uuid?: string;
    paperSize?: SheetSize;
  },
): string {
  const uuid = options?.uuid || `circuit-${Date.now()}`;
  const title = options?.title || "Circuit Snippet";
  const paperSize = options?.paperSize || "A4";

  // Create a complete KiCad schematic file structure
  // Version 20231120 is KiCad 8.0 format
  return `(kicad_sch
  (version 20231120)
  (generator "CircuitSnips")
  (generator_version "1.0")

  (uuid "${uuid}")

  (paper "${paperSize}")

  (title_block
    (title "${title}")
    (date "${new Date().toISOString().split("T")[0]}")
    (rev "1")
    (company "CircuitSnips")
  )

${snippet}
)`;
}

/**
 * Extract snippet from a full .kicad_sch file
 * Removes the kicad_sch wrapper, keeping only lib_symbols and symbol content
 */
export function extractSnippetFromFullFile(fullFile: string): string {
  try {
    const tree = parseSExpression(fullFile);

    if (tree.type !== "list" || !tree.children) {
      throw new Error("Invalid S-expression structure");
    }

    // Find lib_symbols and symbol nodes
    const snippetParts: string[] = [];

    for (const child of tree.children) {
      if (child.type === "list" && child.children) {
        const tag = child.children[0];
        if (
          tag.type === "atom" &&
          (tag.value === "lib_symbols" || tag.value === "symbol")
        ) {
          // Reconstruct this node as S-expression text
          snippetParts.push(nodeToString(child));
        }
      }
    }

    return snippetParts.join("\n\n");
  } catch (error) {
    // If parsing fails, fall back to regex extraction
    const libSymbolsMatch = fullFile.match(
      /(\(lib_symbols[\s\S]*?\n\)(?=\s*\n\s*\())/,
    );
    const symbolsMatch = fullFile.match(
      /(\(symbol[\s\S]*?\n\s*\)(?=\s*\n\s*\())/g,
    );

    const parts: string[] = [];
    if (libSymbolsMatch) parts.push(libSymbolsMatch[1]);
    if (symbolsMatch) parts.push(...symbolsMatch);

    return parts.join("\n\n");
  }
}

/**
 * Convert S-expression node back to string format
 */
function nodeToString(node: SExprNode, indent = 0): string {
  const indentStr = "  ".repeat(indent);

  if (node.type === "atom") {
    return node.value || "";
  }

  if (node.type === "string") {
    return `"${node.value}"`;
  }

  if (node.type === "list" && node.children) {
    if (node.children.length === 0) {
      return "()";
    }

    const childrenStr = node.children
      .map((child, i) => {
        if (i === 0) return nodeToString(child, indent);
        return nodeToString(child, indent + 1);
      })
      .join("\n" + indentStr);

    return `(${childrenStr})`;
  }

  return "";
}

/**
 * Add attribution comments to a full .kicad_sch file
 * Should only be called on full files, not snippets
 */
export function addAttribution(
  fullFile: string,
  options: {
    author: string;
    url: string;
    license: string;
    title?: string;
  },
): string {
  const lines = fullFile.split("\n");
  let insertIndex = 0;

  // Find where to insert (after generator, version, or uuid)
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("(generator") ||
      lines[i].includes("(version") ||
      lines[i].includes("(uuid")
    ) {
      insertIndex = i + 1;
    }
    if (lines[i].includes("(paper")) {
      break;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const attribution = [
    `  (comment 1 "Source: ${options.url}")`,
    `  (comment 2 "Author: ${options.author}")`,
    `  (comment 3 "License: ${options.license}")`,
    `  (comment 4 "Downloaded: ${today}")`,
    "",
  ].join("\n");

  lines.splice(insertIndex, 0, attribution);
  return lines.join("\n");
}

/**
 * Add GitHub attribution comments to a schematic
 * Used for batch import to track circuit origins
 */
export function addGitHubAttribution(
  sexpr: string,
  options: {
    repoOwner: string;
    repoName: string;
    repoUrl: string;
    filePath: string;
    license: string;
    score?: number;
  },
): string {
  // Check if it's a full file or snippet
  const isSnippet = isClipboardSnippet(sexpr);

  // If snippet, wrap it first
  const fullFile = isSnippet
    ? wrapSnippetToFullFile(sexpr, {
        title: `${options.repoOwner}/${options.repoName}`,
      })
    : sexpr;

  const lines = fullFile.split("\n");
  let insertIndex = 0;

  // Find where to insert (after generator, version, or uuid)
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("(generator") ||
      lines[i].includes("(version") ||
      lines[i].includes("(uuid")
    ) {
      insertIndex = i + 1;
    }
    if (lines[i].includes("(paper")) {
      break;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const scoreText =
    options.score !== undefined ? ` | Quality: ${options.score}/10` : "";

  const attribution = [
    `  (comment 1 "GitHub: ${options.repoUrl}")`,
    `  (comment 2 "Source: ${options.repoOwner}/${options.repoName} | ${options.filePath}")`,
    `  (comment 3 "License: ${options.license}${scoreText}")`,
    `  (comment 4 "Imported: ${today} | CircuitSnips.com")`,
    "",
  ].join("\n");

  lines.splice(insertIndex, 0, attribution);
  return lines.join("\n");
}

// ============================================================================
// PARSING: Tree-based S-expression parser
// ============================================================================

/**
 * Parse S-expression text into a tree structure
 * This is more robust than regex for complex nested structures
 */
export function parseSExpression(sexpr: string): SExprNode {
  let pos = 0;

  function parseToken(): SExprNode {
    // Skip whitespace
    while (pos < sexpr.length && /\s/.test(sexpr[pos])) {
      pos++;
    }

    if (pos >= sexpr.length) {
      throw new Error("Unexpected end of input");
    }

    // Parse list
    if (sexpr[pos] === "(") {
      pos++; // skip '('
      const children: SExprNode[] = [];

      while (true) {
        // Skip whitespace
        while (pos < sexpr.length && /\s/.test(sexpr[pos])) {
          pos++;
        }

        if (pos >= sexpr.length) {
          throw new Error("Unclosed list");
        }

        if (sexpr[pos] === ")") {
          pos++; // skip ')'
          break;
        }

        children.push(parseToken());
      }

      return { type: "list", children };
    }

    // Parse quoted string
    if (sexpr[pos] === '"') {
      pos++; // skip '"'
      let value = "";

      while (pos < sexpr.length && sexpr[pos] !== '"') {
        if (sexpr[pos] === "\\" && pos + 1 < sexpr.length) {
          pos++; // skip escape character
        }
        value += sexpr[pos];
        pos++;
      }

      if (pos >= sexpr.length) {
        throw new Error("Unclosed string");
      }

      pos++; // skip closing '"'
      return { type: "string", value };
    }

    // Parse atom (unquoted token)
    let value = "";
    while (pos < sexpr.length && !/[\s()"]/.test(sexpr[pos])) {
      value += sexpr[pos];
      pos++;
    }

    return { type: "atom", value };
  }

  return parseToken();
}

// ============================================================================
// VALIDATION: Check format and version
// ============================================================================

/**
 * Validate KiCad S-expression (handles both snippets and full files)
 */
export function validateSExpression(sexpr: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic format validation
  if (!sexpr || sexpr.trim().length === 0) {
    errors.push("Empty input");
    return {
      valid: false,
      errors,
      warnings,
      isSnippet: false,
      originalFormat: "full",
    };
  }

  // Check for balanced parentheses
  let depth = 0;
  for (const char of sexpr) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth < 0) {
      errors.push("Unbalanced parentheses - extra closing parenthesis");
      return {
        valid: false,
        errors,
        warnings,
        isSnippet: false,
        originalFormat: "full",
      };
    }
  }
  if (depth !== 0) {
    errors.push("Unbalanced parentheses - missing closing parenthesis");
    return {
      valid: false,
      errors,
      warnings,
      isSnippet: false,
      originalFormat: "full",
    };
  }

  // Detect format type
  const isSnippet = isClipboardSnippet(sexpr);
  const originalFormat = isSnippet ? "snippet" : "full";

  // For validation and metadata extraction, we need a full file
  let workingSexpr = sexpr;
  if (isSnippet) {
    warnings.push(
      "Clipboard snippet detected - will be stored as-is, wrapped for preview",
    );
    workingSexpr = wrapSnippetToFullFile(sexpr, { title: "Validation" });
  }

  // Validate it's a KiCad file
  try {
    const tree = parseSExpression(workingSexpr);

    if (tree.type !== "list" || !tree.children || tree.children.length === 0) {
      errors.push("Invalid S-expression structure");
      return { valid: false, errors, warnings, isSnippet, originalFormat };
    }

    const firstChild = tree.children[0];
    if (firstChild.type !== "atom" || firstChild.value !== "kicad_sch") {
      if (!isSnippet) {
        errors.push("Not a KiCad schematic file (expected kicad_sch)");
        return { valid: false, errors, warnings, isSnippet, originalFormat };
      }
    }

    // Find and validate version
    let version: number | undefined;
    for (const child of tree.children) {
      if (
        child.type === "list" &&
        child.children &&
        child.children.length >= 2
      ) {
        const tag = child.children[0];
        if (tag.type === "atom" && tag.value === "version") {
          const versionNode = child.children[1];
          if (versionNode.type === "atom" || versionNode.type === "string") {
            version = parseInt(versionNode.value || "0", 10);
          }
        }
      }
    }

    // Check version is KiCad 6+ (version >= 20211014)
    if (!version || version < 20211014) {
      errors.push(
        "KiCad 5 or earlier format detected. Please use KiCad 6 or later.",
      );
      return { valid: false, errors, warnings, isSnippet, originalFormat };
    }

    // Extract metadata
    const metadata = extractMetadata(workingSexpr);

    // Add warnings based on metadata
    if (metadata.components.length === 0) {
      warnings.push("No components found in schematic");
    }

    if (metadata.footprints.unassigned > 0) {
      warnings.push(
        `${metadata.footprints.unassigned} component(s) missing footprint assignments`,
      );
    }

    if (metadata.stats.wireCount === 0 && metadata.components.length > 1) {
      warnings.push("No wires found - components may not be connected");
    }

    // Merge metadata warnings
    if (metadata.warnings) {
      warnings.push(...metadata.warnings);
    }

    return {
      valid: true,
      errors,
      warnings,
      metadata,
      isSnippet,
      originalFormat,
    };
  } catch (error) {
    errors.push(
      `Failed to parse schematic: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return { valid: false, errors, warnings, isSnippet, originalFormat };
  }
}

// ============================================================================
// METADATA EXTRACTION: Parse components, nets, stats
// ============================================================================

/**
 * Extract metadata from S-expression (must be full file format)
 */
export function extractMetadata(sexpr: string): ParsedMetadata {
  const tree = parseSExpression(sexpr);

  const components: Component[] = [];
  const nets: Net[] = [];
  const netNames = new Set<string>();
  let wireCount = 0;
  let version = "unknown";

  function findInList(node: SExprNode, tag: string): SExprNode | undefined {
    if (node.type !== "list" || !node.children) return undefined;
    return node.children.find(
      (child) =>
        child.type === "list" &&
        child.children &&
        child.children[0]?.type === "atom" &&
        child.children[0]?.value === tag,
    );
  }

  function getStringValue(
    node: SExprNode,
    tag: string,
    defaultValue = "",
  ): string {
    const found = findInList(node, tag);
    if (found && found.children && found.children[1]) {
      return found.children[1].value || defaultValue;
    }
    return defaultValue;
  }

  function findPropertyValue(node: SExprNode, propertyName: string): string {
    if (node.type !== "list" || !node.children) return "";

    for (const child of node.children) {
      if (child.type === "list" && child.children) {
        const tag = child.children[0];
        if (tag.type === "atom" && tag.value === "property") {
          const nameNode = child.children[1];
          const valueNode = child.children[2];
          if (nameNode?.value === propertyName && valueNode?.value) {
            return valueNode.value;
          }
        }
      }
    }
    return "";
  }

  function traverse(node: SExprNode) {
    if (node.type !== "list" || !node.children || node.children.length === 0)
      return;

    const tag = node.children[0];
    if (tag.type !== "atom") return;

    switch (tag.value) {
      case "version":
        if (node.children[1]) {
          version = node.children[1].value || "unknown";
        }
        break;

      case "symbol": {
        // Extract component information
        const lib_id = getStringValue(node, "lib_id");
        const uuid = getStringValue(node, "uuid");
        const reference = findPropertyValue(node, "Reference");
        const value = findPropertyValue(node, "Value");
        const footprint = findPropertyValue(node, "Footprint");

        // Extract position from 'at' node
        const atNode = findInList(node, "at");
        let position = { x: 0, y: 0, angle: 0 };
        if (atNode && atNode.children && atNode.children.length >= 3) {
          position = {
            x: parseFloat(atNode.children[1]?.value || "0"),
            y: parseFloat(atNode.children[2]?.value || "0"),
            angle: parseFloat(atNode.children[3]?.value || "0"),
          };
        }

        if (lib_id) {
          components.push({
            reference,
            value,
            footprint,
            lib_id,
            uuid,
            position,
          });
        }
        break;
      }

      case "label":
      case "global_label":
      case "hierarchical_label": {
        const labelName = node.children[1]?.value || "";
        if (labelName && !netNames.has(labelName)) {
          netNames.add(labelName);
          nets.push({
            name: labelName,
            type: tag.value as "label" | "global_label" | "hierarchical_label",
          });
        }
        break;
      }

      case "wire":
        wireCount++;
        break;
    }

    // Recursively process children
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree);

  // Calculate unique components
  const componentMap = new Map<
    string,
    { values: Set<string>; count: number }
  >();
  for (const comp of components) {
    if (!componentMap.has(comp.lib_id)) {
      componentMap.set(comp.lib_id, { values: new Set(), count: 0 });
    }
    const entry = componentMap.get(comp.lib_id)!;
    entry.values.add(comp.value);
    entry.count++;
  }

  const uniqueComponents = Array.from(componentMap.entries()).map(
    ([lib_id, data]) => ({
      lib_id,
      count: data.count,
      values: Array.from(data.values),
    }),
  );

  // Calculate bounding box
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const comp of components) {
    minX = Math.min(minX, comp.position.x);
    minY = Math.min(minY, comp.position.y);
    maxX = Math.max(maxX, comp.position.x);
    maxY = Math.max(maxY, comp.position.y);
  }
  if (components.length === 0) {
    minX = minY = maxX = maxY = 0;
  }

  // Footprint analysis
  const footprintTypes = new Set<string>();
  let assigned = 0;
  for (const comp of components) {
    if (comp.footprint) {
      assigned++;
      footprintTypes.add(comp.footprint);
    }
  }

  return {
    components,
    uniqueComponents,
    nets,
    stats: {
      componentCount: components.length,
      wireCount,
      netCount: nets.length,
    },
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
    },
    footprints: {
      assigned,
      unassigned: components.length - assigned,
      types: Array.from(footprintTypes),
    },
    version,
  };
}

// ============================================================================
// HELPER UTILITIES: Slugs, tags, categories
// ============================================================================

/**
 * Generate a URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 60); // Limit length
}

/**
 * Auto-suggest tags based on component types
 */
export function suggestTags(metadata: ParsedMetadata): string[] {
  const tags = new Set<string>();

  metadata.components.forEach((component) => {
    const lib = component.lib_id.toLowerCase();
    const value = component.value.toLowerCase();
    const ref = component.reference.toLowerCase();

    // Suggest based on library
    if (lib.includes("opamp") || lib.includes("amplifier")) tags.add("op-amp");
    if (lib.includes("regulator")) tags.add("voltage-regulator");
    if (lib.includes("sensor")) tags.add("sensor");
    if (lib.includes("connector")) tags.add("connector");
    if (lib.includes("mcu") || lib.includes("microcontroller"))
      tags.add("microcontroller");
    if (lib.includes("relay")) tags.add("relay");
    if (lib.includes("transistor")) tags.add("transistor");
    if (lib.includes("diode")) tags.add("diode");

    // Suggest based on value patterns
    if (value.includes("555")) tags.add("timer");
    if (value.includes("lm358") || value.includes("tl072")) tags.add("op-amp");
    if (value.includes("7805") || value.includes("lm317"))
      tags.add("voltage-regulator");
    if (value.includes("esp32") || value.includes("arduino"))
      tags.add("microcontroller");

    // Suggest based on reference prefix
    if (ref.startsWith("u")) tags.add("ic");
    if (ref.startsWith("r")) tags.add("resistor");
    if (ref.startsWith("c")) tags.add("capacitor");
    if (ref.startsWith("l")) tags.add("inductor");
    if (ref.startsWith("d")) tags.add("diode");
    if (ref.startsWith("q")) tags.add("transistor");
  });

  // Voltage detection
  const allValues = metadata.components
    .map((c) => c.value)
    .join(" ")
    .toLowerCase();
  if (allValues.includes("3.3v") || allValues.includes("3v3")) tags.add("3.3v");
  if (allValues.includes("5v")) tags.add("5v");
  if (allValues.includes("12v")) tags.add("12v");

  return Array.from(tags).slice(0, 8); // Limit to 8 suggestions
}

/**
 * Estimate category based on components
 */
export function suggestCategory(metadata: ParsedMetadata): string {
  const components = metadata.components
    .map((c) => `${c.lib_id} ${c.value}`.toLowerCase())
    .join(" ");

  if (
    components.includes("regulator") ||
    components.includes("7805") ||
    components.includes("lm317")
  ) {
    return "Power Supply";
  }
  if (
    components.includes("opamp") ||
    components.includes("amplifier") ||
    components.includes("lm358")
  ) {
    return "Analog";
  }
  if (
    components.includes("mcu") ||
    components.includes("esp") ||
    components.includes("arduino")
  ) {
    return "Microcontroller";
  }
  if (
    components.includes("sensor") ||
    components.includes("temperature") ||
    components.includes("pressure")
  ) {
    return "Sensors";
  }
  if (
    components.includes("relay") ||
    (components.includes("transistor") && components.includes("load"))
  ) {
    return "Control";
  }
  if (
    components.includes("uart") ||
    components.includes("spi") ||
    components.includes("i2c")
  ) {
    return "Communication";
  }
  if (components.includes("led") || components.includes("display")) {
    return "Display/LED";
  }

  return "General";
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
  let result = sexpr.replace(sheetInstancesRegex, "");

  // Remove individual (sheet ...) elements (hierarchical sheet symbols on schematic)
  // Match (sheet ... ) including nested parentheses
  const sheetRegex = /\(sheet\s+[^(]*(?:\([^)]*\)[^(]*)*\)/g;
  result = result.replace(sheetRegex, "");

  return result;
}
