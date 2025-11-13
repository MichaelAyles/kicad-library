/**
 * Fix Imported Circuit Licenses
 *
 * This script fixes circuits imported from GitHub that have incorrect licenses.
 * It extracts the actual license from the description and updates the database.
 *
 * Usage:
 *   npx tsx scripts/fix-imported-licenses.ts [--dry-run]
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { normalizeLicense } from '../src/lib/batch-import/validator';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botUserId = process.env.BOT_USER_ID;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!botUserId) {
  console.error('Warning: BOT_USER_ID not set, will process all circuits with GitHub attribution');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  license: string;
  user_id: string;
}

/**
 * Extract license from GitHub attribution in description
 * Format: > **From GitHub**: [owner/repo](url) ([LICENSE license](link))
 */
function extractLicenseFromDescription(description: string): string | null {
  // Try multiple patterns to match different license formats

  // Pattern 1: ([LICENSE license](link))
  let licenseMatch = description.match(/\(\[([^\]]+)\s+license\]/i);
  if (licenseMatch && licenseMatch[1]) {
    return normalizeExtractedLicense(licenseMatch[1].trim());
  }

  // Pattern 2: ([LICENSE](link)) - without "license" word
  licenseMatch = description.match(/\(\[([A-Z][A-Z0-9\s\-\.]+)\]\([^)]+\/LICENSE\)/);
  if (licenseMatch && licenseMatch[1]) {
    return normalizeExtractedLicense(licenseMatch[1].trim());
  }

  // Pattern 3: License: XXXX in description
  licenseMatch = description.match(/License:\s*([A-Z][A-Z0-9\s\-\.]+)/);
  if (licenseMatch && licenseMatch[1]) {
    return normalizeExtractedLicense(licenseMatch[1].trim());
  }

  return null;
}

/**
 * Normalize extracted license names to standard identifiers
 * Converts full names like "Creative Commons Zero v1.0 Universal" to "CC0-1.0"
 */
function normalizeExtractedLicense(license: string): string {
  const mapping: Record<string, string> = {
    'creative commons zero v1.0 universal': 'CC0-1.0',
    'creative commons attribution 4.0 international': 'CC-BY-4.0',
    'creative commons attribution share alike 4.0 international': 'CC-BY-SA-4.0',
    'creative commons attribution non commercial share alike 4.0 international': 'CC-BY-NC-SA-4.0',
    'creative commons attribution non commercial 4.0 international': 'CC-BY-NC-4.0',
    'creative commons attribution no derivatives 4.0 international': 'CC-BY-ND-4.0',
    'mit license': 'MIT',
    'apache license 2.0': 'Apache-2.0',
    'gnu general public license v2.0': 'GPL-2.0',
    'gnu general public license v3.0': 'GPL-3.0',
    'gnu lesser general public license v2.1': 'LGPL-2.1',
    'gnu lesser general public license v3.0': 'LGPL-3.0',
    'gnu affero general public license v3.0': 'AGPL-3.0',
    'mozilla public license 2.0': 'MPL-2.0',
    'bsd 2-clause "simplified" license': 'BSD-2-Clause',
    'bsd 3-clause "new" or "revised" license': 'BSD-3-Clause',
    'the unlicense': 'Unlicense',
    'cern open hardware licence version 2 - strongly reciprocal': 'CERN-OHL-S-2.0',
    'cern open hardware licence version 2 - weakly reciprocal': 'CERN-OHL-W-2.0',
    'cern open hardware licence version 2 - permissive': 'CERN-OHL-P-2.0',
    'cern-ohl-1.2': 'CERN-OHL-1.2',
  };

  const lowerLicense = license.toLowerCase();

  // Check if it's in our mapping
  if (mapping[lowerLicense]) {
    return mapping[lowerLicense];
  }

  // Return as-is if not found
  return license;
}

async function fixCircuitLicenses(dryRun: boolean = false) {
  console.log('🔍 Scanning for circuits with incorrect licenses...\n');

  // Fetch all circuits with GitHub attribution
  const query = supabase
    .from('circuits')
    .select('id, slug, title, description, license, user_id')
    .like('description', '%**From GitHub**:%');

  // If BOT_USER_ID is set, filter by user_id
  if (botUserId) {
    query.eq('user_id', botUserId);
  }

  const { data: circuits, error } = await query;

  if (error) {
    console.error('Error fetching circuits:', error);
    process.exit(1);
  }

  if (!circuits || circuits.length === 0) {
    console.log('No circuits found with GitHub attribution.');
    return;
  }

  console.log(`Found ${circuits.length} circuits to check.\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const circuit of circuits) {
    // Extract the license from the description
    const extractedLicense = extractLicenseFromDescription(circuit.description);

    if (!extractedLicense) {
      console.log(`⚠️  [${circuit.slug}] - Could not extract license from description`);
      skippedCount++;
      continue;
    }

    // Normalize the extracted license
    const normalizedLicense = normalizeLicense(extractedLicense) || extractedLicense;

    // Check if the license needs to be updated
    if (circuit.license === normalizedLicense) {
      // License is already correct
      skippedCount++;
      continue;
    }

    console.log(`📝 [${circuit.slug}]`);
    console.log(`   Title: ${circuit.title}`);
    console.log(`   Current: ${circuit.license}`);
    console.log(`   Extracted: ${extractedLicense}`);
    console.log(`   Normalized: ${normalizedLicense}`);

    if (dryRun) {
      console.log(`   ⏭️  DRY RUN - Would update to: ${normalizedLicense}\n`);
      fixedCount++;
    } else {
      // Update the license in the database
      const { error: updateError } = await supabase
        .from('circuits')
        .update({ license: normalizedLicense })
        .eq('id', circuit.id);

      if (updateError) {
        console.log(`   ❌ Error updating: ${updateError.message}\n`);
        errorCount++;
      } else {
        console.log(`   ✅ Updated to: ${normalizedLicense}\n`);
        fixedCount++;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total circuits checked: ${circuits.length}`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Skipped (already correct): ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔬 Running in DRY RUN mode - no changes will be made\n');
}

fixCircuitLicenses(dryRun)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
