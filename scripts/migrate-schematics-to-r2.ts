/**
 * Migration Script: Migrate schematics from Supabase to R2
 *
 * This script migrates existing circuits' raw_sexpr data to R2 storage.
 * It processes circuits in batches and is resumable (only processes circuits
 * without schematic_r2_url).
 *
 * Usage:
 *   npx tsx scripts/migrate-schematics-to-r2.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - R2_ACCOUNT_ID
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_BUCKET_NAME
 *   - R2_PUBLIC_URL
 */

// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  isClipboardSnippet,
  wrapSnippetToFullFile,
  replacePaperSize,
  removeHierarchicalSheets,
  validateSExpression,
  selectSheetSize,
  type SheetSize,
} from "../src/lib/kicad-parser";

// Configuration
const BATCH_SIZE = 50;
const DRY_RUN = process.argv.includes("--dry-run");

// Initialize Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key for full access, fall back to anon key for dry-run (read-only)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !DRY_RUN) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for actual migration (not dry-run)",
    );
  }

  return createClient(url, key);
}

// Initialize R2 client
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Process schematic for R2 storage
function processSchematic(
  circuitId: string,
  rawSexpr: string,
  title: string,
  sheetSizeOverride: SheetSize | null,
): string {
  // 1. Determine paper size
  let paperSize: SheetSize = "A4";
  if (sheetSizeOverride) {
    paperSize = sheetSizeOverride;
  } else {
    const validation = validateSExpression(rawSexpr);
    if (validation.valid && validation.metadata) {
      paperSize = selectSheetSize(validation.metadata.boundingBox).size;
    }
  }

  // 2. Wrap if snippet, or replace paper size if full file
  let processed: string;
  if (isClipboardSnippet(rawSexpr)) {
    processed = wrapSnippetToFullFile(rawSexpr, {
      title,
      uuid: circuitId,
      paperSize,
    });
  } else {
    processed = replacePaperSize(rawSexpr, paperSize);
  }

  // 3. Remove hierarchical sheet references
  processed = removeHierarchicalSheets(processed);

  return processed;
}

// Upload schematic to R2
async function uploadToR2(
  r2Client: S3Client,
  circuitId: string,
  processedSchematic: string,
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!;
  const key = `schematics/${circuitId}.kicad_sch`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: processedSchematic,
    ContentType: "text/plain; charset=utf-8",
    CacheControl: "public, max-age=31536000, immutable",
  });

  await r2Client.send(command);

  return `${publicUrl}/${key}`;
}

// Main migration function
async function migrate() {
  console.log("=".repeat(60));
  console.log("Schematic Migration: Supabase -> R2");
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN MODE - No changes will be made\n");
  }

  const supabase = getSupabase();
  const r2Client = getR2Client();

  // Get count of circuits needing migration
  const { count: totalCount, error: countError } = await supabase
    .from("circuits")
    .select("id", { count: "exact", head: true })
    .is("schematic_r2_url", null);

  if (countError) {
    console.error("Failed to count circuits:", countError);
    process.exit(1);
  }

  console.log(`\nCircuits to migrate: ${totalCount}`);

  if (totalCount === 0) {
    console.log("✅ All circuits already migrated!");
    process.exit(0);
  }

  let offset = 0;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (true) {
    // Fetch batch of circuits
    const { data: circuits, error: fetchError } = await supabase
      .from("circuits")
      .select("id, title, raw_sexpr, sheet_size")
      .is("schematic_r2_url", null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error("Failed to fetch circuits:", fetchError);
      process.exit(1);
    }

    if (!circuits || circuits.length === 0) {
      break;
    }

    console.log(`\nProcessing batch: ${offset + 1} to ${offset + circuits.length}`);

    for (const circuit of circuits) {
      processed++;
      const progress = `[${processed}/${totalCount}]`;

      try {
        // Process schematic
        const processedSchematic = processSchematic(
          circuit.id,
          circuit.raw_sexpr,
          circuit.title,
          circuit.sheet_size as SheetSize | null,
        );

        if (DRY_RUN) {
          console.log(`${progress} Would migrate: ${circuit.id} (${circuit.title.slice(0, 40)}...)`);
          succeeded++;
          continue;
        }

        // Upload to R2
        const r2Url = await uploadToR2(r2Client, circuit.id, processedSchematic);

        // Update database
        const { error: updateError } = await supabase
          .from("circuits")
          .update({ schematic_r2_url: r2Url })
          .eq("id", circuit.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`${progress} ✅ ${circuit.id} (${circuit.title.slice(0, 40)}...)`);
        succeeded++;
      } catch (error) {
        console.error(`${progress} ❌ ${circuit.id}: ${error}`);
        failed++;
      }
    }

    offset += BATCH_SIZE;

    // Small delay to avoid overwhelming the APIs
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n" + "=".repeat(60));
  console.log("Migration Complete");
  console.log("=".repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n⚠️  Some circuits failed to migrate. Run again to retry.");
    process.exit(1);
  }

  console.log("\n✅ All circuits migrated successfully!");
}

// Run migration
migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
