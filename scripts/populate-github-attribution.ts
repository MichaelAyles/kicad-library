/**
 * Populate GitHub Attribution Fields
 *
 * This script extracts GitHub owner and repo from circuit descriptions
 * and populates the github_owner and github_repo fields.
 *
 * Usage:
 *   npx tsx scripts/populate-github-attribution.ts [--dry-run]
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  github_owner: string | null;
  github_repo: string | null;
}

/**
 * Extract GitHub owner and repo from description
 * Format: > **From GitHub**: [owner/repo](url)
 */
function extractGitHubInfo(description: string): { owner: string | null; repo: string | null } {
  // Pattern: > **From GitHub**: [owner/repo](url)
  const match = description.match(/>\s*\*\*From GitHub\*\*:\s*\[([^/]+)\/([^\]]+)\]/i);

  if (match && match[1] && match[2]) {
    return {
      owner: match[1].trim(),
      repo: match[2].trim()
    };
  }

  return { owner: null, repo: null };
}

async function populateGitHubAttribution(dryRun: boolean = false) {
  console.log('🔍 Scanning for circuits with GitHub attribution...\n');

  // Fetch all circuits with GitHub attribution that don't have github_owner set
  let allCircuits: Circuit[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const query = supabase
      .from('circuits')
      .select('id, slug, title, description, github_owner, github_repo')
      .like('description', '%**From GitHub**:%')
      .is('github_owner', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data: circuits, error } = await query;

    if (error) {
      console.error('Error fetching circuits:', error);
      process.exit(1);
    }

    if (!circuits || circuits.length === 0) {
      hasMore = false;
      break;
    }

    allCircuits = allCircuits.concat(circuits);
    console.log(`Fetched page ${page + 1} (${circuits.length} circuits, ${allCircuits.length} total so far)...`);

    if (circuits.length < pageSize) {
      hasMore = false;
    }

    page++;
  }

  if (allCircuits.length === 0) {
    console.log('No circuits found needing GitHub attribution.');
    return;
  }

  console.log(`\nFound ${allCircuits.length} circuits to update.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const circuit of allCircuits) {
    // Extract GitHub info from the description
    const { owner, repo } = extractGitHubInfo(circuit.description);

    if (!owner || !repo) {
      console.log(`⚠️  [${circuit.slug}] - Could not extract GitHub info from description`);
      skippedCount++;
      continue;
    }

    console.log(`📝 [${circuit.slug}]`);
    console.log(`   Title: ${circuit.title}`);
    console.log(`   GitHub: ${owner}/${repo}`);

    if (dryRun) {
      console.log(`   ⏭️  DRY RUN - Would set github_owner=${owner}, github_repo=${repo}\n`);
      updatedCount++;
    } else {
      // Update the database
      const { error: updateError } = await supabase
        .from('circuits')
        .update({
          github_owner: owner,
          github_repo: repo
        })
        .eq('id', circuit.id);

      if (updateError) {
        console.log(`   ❌ Error updating: ${updateError.message}\n`);
        errorCount++;
      } else {
        console.log(`   ✅ Updated successfully\n`);
        updatedCount++;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total circuits checked: ${allCircuits.length}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (no GitHub info): ${skippedCount}`);
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

populateGitHubAttribution(dryRun)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
