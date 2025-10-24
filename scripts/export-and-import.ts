/**
 * Export and Import Script
 *
 * Reads circuits from the scraper SQLite database and imports them to CircuitSnips
 * via the batch import API
 *
 * Usage:
 *   npx tsx scripts/export-and-import.ts [options]
 *
 * Options:
 *   --data-dir <path>       Path to data directory (default: ../data)
 *   --min-score <number>    Minimum classification score (default: 7)
 *   --batch-size <number>   Records per batch (default: 50)
 *   --limit <number>        Max total records to import (default: no limit)
 *   --dry-run               Preview without sending to API
 *   --api-url <url>         API endpoint (default: http://localhost:3000)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  dataDir: string;
  minScore: number;
  batchSize: number;
  limit: number | null;
  dryRun: boolean;
  apiUrl: string;
  apiKey: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    dataDir: path.resolve(__dirname, '../../data'),
    minScore: 7,
    batchSize: 50,
    limit: null,
    dryRun: false,
    apiUrl: 'http://localhost:3000',
    apiKey: process.env.ADMIN_API_KEY || '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--data-dir':
        config.dataDir = path.resolve(args[++i]);
        break;
      case '--min-score':
        config.minScore = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--limit':
        config.limit = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--api-url':
        config.apiUrl = args[++i];
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  return config;
}

// ============================================================================
// Database Types
// ============================================================================

interface DbRow {
  file_id: number;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  repo_license: string;
  file_path: string;
  local_path: string;
  component_count: number;
  classification_score: number;
  classification_data: string;
}

interface Subcircuit {
  name: string;
  description: string;
  components?: string;
  useCase?: string;
  notes?: string;
  tags: string[];
}

interface ClassificationData {
  subcircuits: Subcircuit[];
}

interface ImportRecord {
  source_file_id: string;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  repo_license: string;
  file_path: string;
  raw_sexpr: string;
  component_count: number;
  classification_score: number;
  subcircuit: Subcircuit;
}

// ============================================================================
// Database Reader
// ============================================================================

function connectDatabase(dbPath: string): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  console.log(`📂 Opening database: ${dbPath}`);
  return new Database(dbPath, { readonly: true });
}

function fetchRecords(db: Database.Database, config: Config): DbRow[] {
  const query = `
    SELECT
      f.id AS file_id,
      r.owner AS repo_owner,
      r.name AS repo_name,
      r.url AS repo_url,
      r.license AS repo_license,
      f.file_path,
      f.local_path,
      f.component_count,
      f.classification_score,
      f.classification_data
    FROM files f
    JOIN repositories r ON f.repo_id = r.id
    WHERE f.classification_score >= ?
      AND f.classification_data IS NOT NULL
      AND f.local_path IS NOT NULL
    ORDER BY f.classification_score DESC, r.stars DESC
    ${config.limit ? `LIMIT ${config.limit}` : ''}
  `;

  console.log(`🔍 Fetching records with score >= ${config.minScore}...`);
  const stmt = db.prepare(query);
  const rows = stmt.all(config.minScore) as DbRow[];
  console.log(`✅ Found ${rows.length} files`);

  return rows;
}

// ============================================================================
// Data Transformation
// ============================================================================

function transformRowToRecords(
  row: DbRow,
  config: Config
): ImportRecord[] {
  // Parse classification data
  let classificationData: ClassificationData;
  try {
    classificationData = JSON.parse(row.classification_data);
  } catch (error) {
    console.error(`❌ Invalid JSON for file ${row.file_id}:`, error);
    return [];
  }

  if (!classificationData.subcircuits || classificationData.subcircuits.length === 0) {
    console.warn(`⚠️  No subcircuits found for file ${row.file_id}`);
    return [];
  }

  // Read schematic file content
  // Note: local_path in database is already relative to project root (e.g., "data\repos\owner\repo\file.kicad_sch")
  // We need to construct the absolute path from the current working directory
  const schematicPath = path.resolve(row.local_path.replace(/\\/g, '/'));
  if (!fs.existsSync(schematicPath)) {
    console.error(`❌ Schematic file not found: ${schematicPath}`);
    console.error(`   Expected path from database: ${row.local_path}`);
    return [];
  }

  let rawSexpr: string;
  try {
    rawSexpr = fs.readFileSync(schematicPath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading file ${schematicPath}:`, error);
    return [];
  }

  // Create one record per subcircuit
  return classificationData.subcircuits.map((subcircuit, index) => ({
    source_file_id: `${row.file_id}-${index}`,
    repo_owner: row.repo_owner,
    repo_name: row.repo_name,
    repo_url: row.repo_url,
    repo_license: row.repo_license || 'CERN-OHL-S-2.0',
    file_path: row.file_path,
    raw_sexpr: rawSexpr,
    component_count: row.component_count,
    classification_score: row.classification_score,
    subcircuit,
  }));
}

// ============================================================================
// API Sender
// ============================================================================

interface BatchResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  details: any[];
  error?: string;
}

async function sendBatch(
  records: ImportRecord[],
  config: Config,
  batchNumber: number
): Promise<BatchResult> {
  const url = `${config.apiUrl}/api/admin/batch-import`;

  if (config.dryRun) {
    console.log(`[DRY RUN] Would send batch ${batchNumber} with ${records.length} records`);
    return {
      success: true,
      imported: records.length,
      skipped: 0,
      failed: 0,
      details: records.map(r => ({ source_file_id: r.source_file_id, status: 'dry-run' })),
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      imported: result.results.imported,
      skipped: result.results.skipped,
      failed: result.results.failed,
      details: result.details,
    };
  } catch (error: any) {
    console.error(`❌ Error sending batch ${batchNumber}:`, error.message);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: records.length,
      details: [],
      error: error.message,
    };
  }
}

// ============================================================================
// Progress Tracking
// ============================================================================

interface Stats {
  totalFiles: number;
  totalSubcircuits: number;
  totalBatches: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ batch: number; error: string }>;
}

function createStatsTracker(): Stats {
  return {
    totalFiles: 0,
    totalSubcircuits: 0,
    totalBatches: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}

function printProgress(stats: Stats, current: number, total: number): void {
  const percent = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));

  process.stdout.write(
    `\r[${bar}] ${percent}% | Batch ${stats.totalBatches} | ` +
    `✓ ${stats.imported} | ⊘ ${stats.skipped} | ✗ ${stats.failed}`
  );
}

function printFinalStats(stats: Stats): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Import Complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Files processed:       ${stats.totalFiles}`);
  console.log(`Subcircuits extracted: ${stats.totalSubcircuits}`);
  console.log(`Batches sent:          ${stats.totalBatches}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`✅ Successfully imported: ${stats.imported}`);
  console.log(`⊘  Skipped (duplicates): ${stats.skipped}`);
  console.log(`❌ Failed:               ${stats.failed}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => {
      console.log(`  Batch ${e.batch}: ${e.error}`);
    });
  }
}

// ============================================================================
// Main Export Logic
// ============================================================================

async function main() {
  const config = parseArgs();

  // Validation
  if (!config.apiKey && !config.dryRun) {
    console.error('❌ ADMIN_API_KEY environment variable not set!');
    console.log('Set it with: export ADMIN_API_KEY="your-key-here"');
    console.log('Or run with --dry-run to test without API calls');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         CircuitSnips Batch Import Exporter               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`📁 Data directory:    ${config.dataDir}`);
  console.log(`🎯 Min score:         ${config.minScore}`);
  console.log(`📦 Batch size:        ${config.batchSize}`);
  console.log(`🔗 API URL:           ${config.apiUrl}`);
  console.log(`🔐 API key:           ${config.apiKey ? '✓ Set' : '✗ Not set'}`);
  console.log(`🏃 Mode:              ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (config.limit) {
    console.log(`⚠️  Limit:            ${config.limit} files`);
  }
  console.log();

  // Connect to database
  const dbPath = path.join(config.dataDir, 'kicad_repos.db');
  const db = connectDatabase(dbPath);

  // Fetch records
  const rows = fetchRecords(db, config);
  const stats = createStatsTracker();
  stats.totalFiles = rows.length;

  if (rows.length === 0) {
    console.log('⚠️  No records found matching criteria');
    db.close();
    return;
  }

  // Transform rows to import records
  console.log('🔄 Transforming data...');
  const allRecords: ImportRecord[] = [];

  for (const row of rows) {
    const records = transformRowToRecords(row, config);
    allRecords.push(...records);
  }

  stats.totalSubcircuits = allRecords.length;
  console.log(`✅ Extracted ${allRecords.length} subcircuits from ${rows.length} files`);
  console.log();

  if (allRecords.length === 0) {
    console.log('⚠️  No subcircuits to import');
    db.close();
    return;
  }

  // Send in batches
  console.log(`📤 Sending ${allRecords.length} records in batches of ${config.batchSize}...`);
  console.log();

  for (let i = 0; i < allRecords.length; i += config.batchSize) {
    const batch = allRecords.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    stats.totalBatches = batchNumber;

    const result = await sendBatch(batch, config, batchNumber);

    if (result.success) {
      stats.imported += result.imported;
      stats.skipped += result.skipped;
      stats.failed += result.failed;
    } else {
      stats.failed += batch.length;
      stats.errors.push({
        batch: batchNumber,
        error: result.error || 'Unknown error',
      });
    }

    printProgress(stats, i + batch.length, allRecords.length);

    // Rate limiting - wait 1 second between batches
    if (i + config.batchSize < allRecords.length && !config.dryRun) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print final stats
  printFinalStats(stats);

  // Close database
  db.close();
}

// ============================================================================
// Run
// ============================================================================

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
