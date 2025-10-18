/**
 * S-Expression Parser for KiCad Schematics
 *
 * Parses and validates KiCad schematic files (S-expression format)
 * Extracts metadata like components, nets, and statistics
 */

export interface Component {
  reference: string;      // e.g., "R1", "U2"
  value: string;          // e.g., "10k", "LM358"
  footprint: string;      // e.g., "Resistor_SMD:R_0805_2012Metric"
  lib_id: string;         // e.g., "Device:R"
  uuid: string;
  position?: {
    x: number;
    y: number;
    angle?: number;
  };
}

export interface Net {
  name: string;
  type: 'label' | 'global_label' | 'hierarchical_label';
}

export interface ParsedMetadata {
  components: Component[];
  nets: Net[];
  stats: {
    componentCount: number;
    wireCount: number;
    netCount: number;
  };
  footprints: {
    assigned: number;
    total: number;
  };
  version: string;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: ParsedMetadata;
  wrappedSexpr?: string; // For clipboard data - the full kicad_sch wrapped version
}

/**
 * Detect if this is clipboard data (partial) or a full schematic file
 */
export function isClipboardData(sexpr: string): boolean {
  const trimmed = sexpr.trim();
  return trimmed.startsWith('(lib_symbols') && !trimmed.includes('(kicad_sch');
}

/**
 * Wrap clipboard data in a minimal kicad_sch structure
 * This allows KiCanvas to render it and enables proper validation
 */
export function wrapClipboardData(clipboardSexpr: string): string {
  // Create a minimal KiCad schematic wrapper
  // KiCanvas needs this structure to render properly
  const wrapped = `(kicad_sch
  (version 20230121)
  (generator "CircuitSnips")
  (uuid "00000000-0000-0000-0000-000000000000")
  (paper "A4")

  ${clipboardSexpr}
)`;

  return wrapped;
}

/**
 * Validate KiCad S-expression format
 * Handles both full files and clipboard data
 */
export function validateSExpression(sexpr: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic format validation
  if (!sexpr || sexpr.trim().length === 0) {
    errors.push('Empty input');
    return { valid: false, errors, warnings };
  }

  // Check for balanced parentheses
  let depth = 0;
  for (const char of sexpr) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) {
      errors.push('Unbalanced parentheses - extra closing parenthesis');
      return { valid: false, errors, warnings };
    }
  }
  if (depth !== 0) {
    errors.push('Unbalanced parentheses - missing closing parenthesis');
    return { valid: false, errors, warnings };
  }

  // Check if it's clipboard data or full schematic
  let workingSexpr = sexpr;
  let isClipboard = false;
  if (isClipboardData(sexpr)) {
    warnings.push('Clipboard data detected - will be wrapped for storage');
    workingSexpr = wrapClipboardData(sexpr);
    isClipboard = true;
  } else if (!sexpr.includes('kicad_sch')) {
    errors.push('Not a valid KiCad schematic - missing "kicad_sch" or "lib_symbols" identifier');
    return { valid: false, errors, warnings };
  }

  // Check version (support KiCad 6+)
  const versionMatch = workingSexpr.match(/\(version\s+(\d+)\)/);
  if (!versionMatch) {
    errors.push('Cannot determine KiCad version');
    return { valid: false, errors, warnings };
  }

  const version = parseInt(versionMatch[1]);
  if (version < 20211014) {
    errors.push(`Unsupported KiCad version: ${version}. Only KiCad 6+ (version >= 20211014) is supported.`);
    return { valid: false, errors, warnings };
  }

  // Check for generator (indicates it's from KiCad or CircuitSnips)
  const generatorMatch = workingSexpr.match(/\(generator\s+"?([^")\s]+)"?\)/);
  if (!generatorMatch) {
    warnings.push('No generator information found - this may not be from KiCad');
  }

  // Extract metadata from the working S-expression
  try {
    const metadata = extractMetadata(workingSexpr);

    // Add warnings based on metadata
    if (metadata.components.length === 0) {
      warnings.push('No components found in schematic');
    }

    if (metadata.footprints.assigned < metadata.footprints.total) {
      warnings.push(
        `${metadata.footprints.total - metadata.footprints.assigned} component(s) missing footprint assignments`
      );
    }

    if (metadata.stats.wireCount === 0 && metadata.components.length > 1) {
      warnings.push('No wires found - components may not be connected');
    }

    return {
      valid: true,
      errors,
      warnings,
      metadata,
      wrappedSexpr: isClipboard ? workingSexpr : undefined
    };
  } catch (err) {
    errors.push(`Failed to parse schematic: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * Extract metadata from S-expression
 */
export function extractMetadata(sexpr: string): ParsedMetadata {
  const components: Component[] = [];
  const nets: Net[] = [];
  let wireCount = 0;

  // Extract version
  const versionMatch = sexpr.match(/\(version\s+(\d+)\)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  // Extract components (symbols)
  const symbolRegex = /\(symbol\s+\(lib_id\s+"([^"]+)"\)[\s\S]*?\(uuid\s+"([^"]+)"\)[\s\S]*?\(property\s+"Reference"\s+"([^"]+)"[\s\S]*?\(property\s+"Value"\s+"([^"]+)"[\s\S]*?(?:\(property\s+"Footprint"\s+"([^"]+)")?/g;

  let match;
  while ((match = symbolRegex.exec(sexpr)) !== null) {
    const [, lib_id, uuid, reference, value, footprint] = match;
    components.push({
      reference,
      value,
      footprint: footprint || '',
      lib_id,
      uuid,
    });
  }

  // Extract nets (labels)
  const labelRegex = /\((label|global_label|hierarchical_label)\s+"([^"]+)"/g;
  const netNames = new Set<string>();

  while ((match = labelRegex.exec(sexpr)) !== null) {
    const [, type, name] = match;
    if (!netNames.has(name)) {
      netNames.add(name);
      nets.push({
        name,
        type: type as 'label' | 'global_label' | 'hierarchical_label',
      });
    }
  }

  // Count wires
  const wireMatches = sexpr.match(/\(wire/g);
  wireCount = wireMatches ? wireMatches.length : 0;

  // Count footprint assignments
  const assignedFootprints = components.filter(c => c.footprint && c.footprint !== '').length;

  return {
    components,
    nets,
    stats: {
      componentCount: components.length,
      wireCount,
      netCount: nets.length,
    },
    footprints: {
      assigned: assignedFootprints,
      total: components.length,
    },
    version,
  };
}

/**
 * Generate a URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .substring(0, 60);             // Limit length
}

/**
 * Auto-suggest tags based on component types
 */
export function suggestTags(metadata: ParsedMetadata): string[] {
  const tags = new Set<string>();

  metadata.components.forEach(component => {
    const lib = component.lib_id.toLowerCase();
    const value = component.value.toLowerCase();
    const ref = component.reference.toLowerCase();

    // Suggest based on library
    if (lib.includes('opamp') || lib.includes('amplifier')) tags.add('op-amp');
    if (lib.includes('regulator')) tags.add('voltage-regulator');
    if (lib.includes('sensor')) tags.add('sensor');
    if (lib.includes('connector')) tags.add('connector');
    if (lib.includes('mcu') || lib.includes('microcontroller')) tags.add('microcontroller');
    if (lib.includes('relay')) tags.add('relay');
    if (lib.includes('transistor')) tags.add('transistor');
    if (lib.includes('diode')) tags.add('diode');

    // Suggest based on value patterns
    if (value.includes('555')) tags.add('timer');
    if (value.includes('lm358') || value.includes('tl072')) tags.add('op-amp');
    if (value.includes('7805') || value.includes('lm317')) tags.add('voltage-regulator');
    if (value.includes('esp32') || value.includes('arduino')) tags.add('microcontroller');

    // Suggest based on reference prefix
    if (ref.startsWith('u')) tags.add('ic');
    if (ref.startsWith('r')) tags.add('resistor');
    if (ref.startsWith('c')) tags.add('capacitor');
    if (ref.startsWith('l')) tags.add('inductor');
    if (ref.startsWith('d')) tags.add('diode');
    if (ref.startsWith('q')) tags.add('transistor');
  });

  // Voltage detection
  const sexprLower = metadata.components.map(c => c.value).join(' ').toLowerCase();
  if (sexprLower.includes('3.3v') || sexprLower.includes('3v3')) tags.add('3.3v');
  if (sexprLower.includes('5v')) tags.add('5v');
  if (sexprLower.includes('12v')) tags.add('12v');

  return Array.from(tags).slice(0, 8); // Limit to 8 suggestions
}

/**
 * Estimate category based on components
 */
export function suggestCategory(metadata: ParsedMetadata): string {
  const components = metadata.components.map(c =>
    `${c.lib_id} ${c.value}`.toLowerCase()
  ).join(' ');

  if (components.includes('regulator') || components.includes('7805') || components.includes('lm317')) {
    return 'Power Supply';
  }
  if (components.includes('opamp') || components.includes('amplifier') || components.includes('lm358')) {
    return 'Analog';
  }
  if (components.includes('mcu') || components.includes('esp') || components.includes('arduino')) {
    return 'Microcontroller';
  }
  if (components.includes('sensor') || components.includes('temperature') || components.includes('pressure')) {
    return 'Sensors';
  }
  if (components.includes('relay') || components.includes('transistor') && components.includes('load')) {
    return 'Control';
  }
  if (components.includes('uart') || components.includes('spi') || components.includes('i2c')) {
    return 'Communication';
  }
  if (components.includes('led') || components.includes('display')) {
    return 'Display/LED';
  }

  return 'General';
}