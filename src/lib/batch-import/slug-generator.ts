/**
 * Slug Generation for Batch Import
 *
 * Generates unique, SEO-friendly slugs from subcircuit names and repo names
 * with collision handling
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate a slug from subcircuit name and repo name
 *
 * Format: {subcircuit-name}-{repo-name}
 * Example: "3.3V LDO Regulator" + "esp32-board" → "33v-ldo-regulator-esp32-board"
 *
 * @param subcircuitName - Name of the subcircuit
 * @param repoName - Repository name (without owner)
 * @returns Sanitized slug
 */
export function generateBaseSlug(
  subcircuitName: string,
  repoName: string,
): string {
  // Combine name and repo
  const combined = `${subcircuitName} ${repoName}`;

  return sanitizeSlug(combined);
}

/**
 * Sanitize a string to be slug-safe
 * - Lowercase
 * - Alphanumeric + hyphens only
 * - No consecutive hyphens
 * - No leading/trailing hyphens
 */
export function sanitizeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      // Replace non-alphanumeric with hyphens
      .replace(/[^a-z0-9]+/g, "-")
      // Remove consecutive hyphens
      .replace(/-+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-|-$/g, "")
      // Limit length to 100 characters
      .substring(0, 100)
      // Remove trailing hyphen if truncation created one
      .replace(/-$/g, "")
  );
}

/**
 * Generate a unique slug by checking database and handling collisions
 *
 * If base slug exists, appends -2, -3, etc. until unique
 *
 * @param supabase - Supabase client
 * @param subcircuitName - Name of the subcircuit
 * @param repoName - Repository name
 * @returns Unique slug guaranteed not to exist in database
 */
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  subcircuitName: string,
  repoName: string,
): Promise<string> {
  const baseSlug = generateBaseSlug(subcircuitName, repoName);

  // Check if base slug exists
  const { data: existing } = await supabase
    .from("circuits")
    .select("slug")
    .eq("slug", baseSlug)
    .maybeSingle();

  // If no collision, return base slug
  if (!existing) {
    return baseSlug;
  }

  // Handle collision - try with counter
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;

  while (counter < 100) {
    const { data: collision } = await supabase
      .from("circuits")
      .select("slug")
      .eq("slug", uniqueSlug)
      .maybeSingle();

    if (!collision) {
      return uniqueSlug;
    }

    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  // Fallback: append timestamp if we somehow hit 100 collisions
  return `${baseSlug}-${Date.now()}`;
}

/**
 * Validate that a slug meets CircuitSnips requirements
 *
 * @param slug - Slug to validate
 * @returns true if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  // Must match the database constraint
  const slugRegex = /^[a-z0-9-]+$/;

  return (
    slug.length > 0 &&
    slug.length <= 100 &&
    slugRegex.test(slug) &&
    !slug.startsWith("-") &&
    !slug.endsWith("-")
  );
}
