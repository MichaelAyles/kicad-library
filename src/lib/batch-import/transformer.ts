/**
 * Data Transformer for Batch Import
 *
 * Transforms scraper data format into CircuitSnips database schema
 */

import { ImportRecord, normalizeLicense } from './validator';

export interface CircuitData {
  slug: string;
  title: string;
  description: string;
  user_id: string;
  raw_sexpr: string;
  component_count: number;
  wire_count: number;
  net_count: number;
  category: string | null;
  tags: string[];
  license: string;
  is_public: boolean;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
}

/**
 * Transform an import record into CircuitSnips circuit data
 *
 * @param record - Validated import record from scraper
 * @param slug - Pre-generated unique slug
 * @param botUserId - UUID of the bot user account
 * @returns Circuit data ready for database insertion
 */
export function transformToCircuit(
  record: ImportRecord,
  slug: string,
  botUserId: string
): CircuitData {
  const { subcircuit, raw_sexpr, component_count, repo_license } = record;

  // Build enhanced description with attribution
  const description = buildDescription(record);

  // Normalize license
  const license = normalizeLicense(repo_license) || 'CERN-OHL-S-2.0';

  // Infer category from tags
  const category = inferCategory(subcircuit.tags);

  // Sanitize and limit tags
  const tags = sanitizeTags(subcircuit.tags);

  return {
    slug,
    title: subcircuit.name.trim().substring(0, 100),
    description,
    user_id: botUserId,
    raw_sexpr,
    component_count,
    wire_count: 0, // Not provided by scraper
    net_count: 0, // Not provided by scraper
    category,
    tags,
    license,
    is_public: true,
    thumbnail_light_url: null, // Generated later
    thumbnail_dark_url: null, // Generated later
  };
}

/**
 * Build description with GitHub attribution
 *
 * Format:
 * > From GitHub: [owner/repo](url)
 *
 * {original description}
 *
 * **Use Case**: {use case}
 *
 * **Components**: {components}
 */
function buildDescription(record: ImportRecord): string {
  const { subcircuit, repo_owner, repo_name, repo_url, repo_license, file_path, classification_score } = record;

  const parts: string[] = [];

  // GitHub attribution FIRST (most visible)
  const normalizedLicense = normalizeLicense(repo_license);
  const licenseText = normalizedLicense || repo_license;
  parts.push(`> **From GitHub**: [${repo_owner}/${repo_name}](${repo_url}) ([${licenseText} license](${repo_url}/blob/main/LICENSE))`);
  parts.push('');

  // Main description
  parts.push(subcircuit.description.trim());

  // Add use case if present
  if (subcircuit.useCase && subcircuit.useCase.trim()) {
    parts.push('');
    parts.push(`**Use Case**: ${subcircuit.useCase.trim()}`);
  }

  // Add components list if present
  if (subcircuit.components && subcircuit.components.trim()) {
    parts.push('');
    parts.push(`**Components**: ${subcircuit.components.trim()}`);
  }

  // Add notes if present
  if (subcircuit.notes && subcircuit.notes.trim()) {
    parts.push('');
    parts.push(`**Notes**: ${subcircuit.notes.trim()}`);
  }

  const fullDescription = parts.join('\n');

  // Limit to 1000 characters for database
  if (fullDescription.length > 1000) {
    // Try to truncate at a sentence or paragraph boundary
    const truncated = fullDescription.substring(0, 997);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const breakPoint = Math.max(lastPeriod, lastNewline);

    if (breakPoint > 500) {
      return fullDescription.substring(0, breakPoint + 1);
    } else {
      return truncated + '...';
    }
  }

  return fullDescription;
}

/**
 * Infer category from tags
 *
 * Categories in CircuitSnips:
 * - Power Supply
 * - Signal Processing
 * - Communication
 * - Interface
 * - Sensing
 * - Control
 * - Audio
 * - Display
 * - Other
 */
function inferCategory(tags: string[]): string | null {
  const lowerTags = tags.map((t) => t.toLowerCase());

  // Category mapping (first match wins)
  const categoryMap: Record<string, string[]> = {
    'Power Supply': ['power', 'voltage-regulator', 'ldo', 'buck', 'boost', 'converter', 'psu'],
    'Communication': ['uart', 'spi', 'i2c', 'usb', 'ethernet', 'wifi', 'bluetooth', 'serial', 'can'],
    'Interface': ['interface', 'connector', 'gpio', 'bridge', 'adapter'],
    'Sensing': ['sensor', 'adc', 'temperature', 'pressure', 'accelerometer', 'gyroscope'],
    'Signal Processing': ['filter', 'amplifier', 'op-amp', 'dac', 'signal'],
    'Control': ['microcontroller', 'mcu', 'cpu', 'controller', 'processor'],
    'Timing': ['timing', 'clock', 'oscillator', 'crystal', 'rtc'],
    'Display': ['display', 'lcd', 'oled', 'led'],
    'Audio': ['audio', 'speaker', 'microphone', 'codec'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (lowerTags.some((tag) => keywords.includes(tag))) {
      return category;
    }
  }

  return null; // No category matched
}

/**
 * Sanitize tags array
 * - Trim whitespace
 * - Lowercase
 * - Remove duplicates
 * - Limit to 10 tags
 * - Ensure each tag is max 30 chars
 */
function sanitizeTags(tags: string[]): string[] {
  const sanitized = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 30)
    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

  return sanitized.slice(0, 10); // Limit to 10
}

/**
 * Build GitHub attribution comment for S-expression
 *
 * This will be embedded in the schematic file's comments
 */
export function buildSExprAttribution(record: ImportRecord): string {
  const { repo_owner, repo_name, repo_url, file_path, repo_license, classification_score } = record;

  return [
    `Source: ${repo_owner}/${repo_name}`,
    `GitHub: ${repo_url}`,
    `File: ${file_path}`,
    `License: ${repo_license}`,
    `Quality: ${classification_score}/10`,
    `Imported by: CircuitSnips.com`,
  ].join(' | ');
}
