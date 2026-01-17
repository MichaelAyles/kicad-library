#!/usr/bin/env npx tsx
/**
 * Audit and Fix R2 Schematic Files
 *
 * Scans all circuits to find R2 files with corruption (unbalanced parentheses)
 * and can regenerate them from the raw_sexpr stored in the database.
 *
 * Usage:
 *   npx tsx scripts/audit-r2-schematics.ts audit          # Find corrupted files
 *   npx tsx scripts/audit-r2-schematics.ts fix            # Fix corrupted files
 *   npx tsx scripts/audit-r2-schematics.ts fix --dry-run  # Preview fixes
 */

import { createClient } from "@supabase/supabase-js";
import { processAndUploadSchematic } from "../src/lib/r2-schematic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Circuit {
  id: string;
  slug: string;
  title: string;
  schematic_r2_url: string;
  raw_sexpr: string;
}

interface AuditResult {
  id: string;
  slug: string;
  title: string;
  r2Balance: number;
  rawBalance: number;
  r2Corrupted: boolean;
  rawCorrupted: boolean;
  canFix: boolean;
}

/**
 * Check parentheses balance in S-expression
 */
function checkBalance(text: string): number {
  let depth = 0;
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prev = i > 0 ? text[i - 1] : "";

    if (char === '"' && prev !== "\\") {
      inString = !inString;
    } else if (!inString) {
      if (char === "(") depth++;
      if (char === ")") depth--;
    }
  }

  return depth;
}

/**
 * Fetch R2 file content
 */
async function fetchR2Content(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/**
 * Audit circuits for R2 corruption (with pagination to avoid timeouts)
 */
async function auditCircuits(limit?: number): Promise<AuditResult[]> {
  console.log("Fetching circuits (paginated)...");

  const results: AuditResult[] = [];
  let processed = 0;
  let corrupted = 0;
  let offset = 0;
  const pageSize = 100;
  const maxToProcess = limit || Infinity;

  while (processed < maxToProcess) {
    // Fetch page of circuits (only id, slug, title, schematic_r2_url - NOT raw_sexpr yet)
    const { data: circuits, error } = await supabase
      .from("circuits")
      .select("id, slug, title, schematic_r2_url")
      .not("schematic_r2_url", "is", null)
      .range(offset, offset + pageSize - 1)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching circuits:", error);
      break;
    }

    if (!circuits || circuits.length === 0) {
      break; // No more circuits
    }

    for (const circuit of circuits) {
      if (processed >= maxToProcess) break;
      processed++;

      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}... (${corrupted} corrupted so far)`);
      }

      // Fetch and check R2 content
      const r2Content = await fetchR2Content(circuit.schematic_r2_url);
      const r2Balance = r2Content ? checkBalance(r2Content) : null;

      const r2Corrupted = r2Balance !== null && r2Balance !== 0;

      if (r2Corrupted) {
        // Only fetch raw_sexpr for corrupted ones (to check if fixable)
        const { data: fullCircuit } = await supabase
          .from("circuits")
          .select("raw_sexpr")
          .eq("id", circuit.id)
          .single();

        const rawBalance = fullCircuit?.raw_sexpr ? checkBalance(fullCircuit.raw_sexpr) : null;
        const rawCorrupted = rawBalance !== null && rawBalance !== 0;
        const canFix = !rawCorrupted;

        corrupted++;
        results.push({
          id: circuit.id,
          slug: circuit.slug,
          title: circuit.title,
          r2Balance: r2Balance || 0,
          rawBalance: rawBalance || 0,
          r2Corrupted,
          rawCorrupted,
          canFix,
        });
      }
    }

    offset += pageSize;
  }

  console.log(`\nAudit complete: ${corrupted} corrupted out of ${processed} circuits`);
  return results;
}

/**
 * Fix corrupted R2 files by regenerating from raw_sexpr
 */
async function fixCorruptedCircuits(
  results: AuditResult[],
  dryRun: boolean
): Promise<void> {
  const fixable = results.filter((r) => r.canFix);
  console.log(`\nFixable circuits: ${fixable.length}`);

  if (fixable.length === 0) {
    console.log("Nothing to fix!");
    return;
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would fix these circuits:");
    for (const r of fixable) {
      console.log(`  - ${r.slug} (R2 balance: ${r.r2Balance})`);
    }
    return;
  }

  console.log("\nFixing corrupted circuits...");

  for (const result of fixable) {
    console.log(`\nFixing: ${result.slug}`);

    // Fetch raw_sexpr
    const { data: circuit, error } = await supabase
      .from("circuits")
      .select("raw_sexpr, title")
      .eq("id", result.id)
      .single();

    if (error || !circuit) {
      console.log(`  ERROR: Could not fetch circuit data`);
      continue;
    }

    try {
      // Process and upload to R2 (uses the existing r2-schematic utility)
      await processAndUploadSchematic({
        circuitId: result.id,
        rawSexpr: circuit.raw_sexpr,
        title: circuit.title || "Circuit",
      });

      console.log(`  ✓ Fixed successfully`);
    } catch (uploadError) {
      console.log(`  ERROR: Upload failed - ${uploadError}`);
      continue;
    }
  }

  console.log("\nFix complete!");
}

/**
 * Print audit report
 */
function printReport(results: AuditResult[]): void {
  if (results.length === 0) {
    console.log("\n✓ No corrupted R2 files found!");
    return;
  }

  console.log("\n" + "=".repeat(80));
  console.log("CORRUPTED R2 FILES");
  console.log("=".repeat(80));

  const fixable = results.filter((r) => r.canFix);
  const unfixable = results.filter((r) => !r.canFix);

  if (fixable.length > 0) {
    console.log(`\n✓ FIXABLE (${fixable.length} circuits):`);
    for (const r of fixable.slice(0, 20)) {
      console.log(`  ${r.slug}`);
      console.log(`    R2 balance: ${r.r2Balance}, Raw balance: ${r.rawBalance}`);
    }
    if (fixable.length > 20) {
      console.log(`  ... and ${fixable.length - 20} more`);
    }
  }

  if (unfixable.length > 0) {
    console.log(`\n✗ UNFIXABLE (${unfixable.length} circuits - raw_sexpr also corrupted):`);
    for (const r of unfixable.slice(0, 10)) {
      console.log(`  ${r.slug}`);
      console.log(`    R2 balance: ${r.r2Balance}, Raw balance: ${r.rawBalance}`);
    }
    if (unfixable.length > 10) {
      console.log(`  ... and ${unfixable.length - 10} more`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`Total corrupted: ${results.length}`);
  console.log(`  Fixable: ${fixable.length}`);
  console.log(`  Unfixable: ${unfixable.length}`);
  console.log("=".repeat(80));
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "audit";
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

  console.log("R2 Schematic Audit Tool");
  console.log("=======================\n");

  if (command === "audit") {
    const results = await auditCircuits(limit);
    printReport(results);
  } else if (command === "fix") {
    const results = await auditCircuits(limit);
    printReport(results);
    await fixCorruptedCircuits(results, dryRun);
  } else {
    console.log("Usage:");
    console.log("  npx tsx scripts/audit-r2-schematics.ts audit [--limit=N]");
    console.log("  npx tsx scripts/audit-r2-schematics.ts fix [--dry-run] [--limit=N]");
  }
}

main().catch(console.error);
