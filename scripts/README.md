# CircuitSnips Import Scripts

This directory contains scripts for importing circuits from external sources into CircuitSnips.

## Export and Import Script

`export-and-import.ts` - Reads circuits from the GitHub scraper SQLite database and imports them via the batch import API.

### Prerequisites

1. **Complete the batch import setup** (see `BATCH_IMPORT_SETUP.md`)
   - Run database migration
   - Create bot user
   - Generate admin API key
   - Set environment variables

2. **Scraper data in `/data` directory**
   ```
   C:\Users\mikea\...\data\
   ├── kicad_repos.db           ← SQLite database
   └── repos\                   ← Schematic files
       └── {owner}\{repo}\...
   ```

3. **Environment variables set**
   ```bash
   export ADMIN_API_KEY="your-generated-key"
   ```

### Quick Start

```bash
# Test with dry run (no actual imports)
npm run import:test

# Dry run all records
npm run import:dry

# Live import (requires API key)
npm run import
```

### Usage

```bash
npx tsx scripts/export-and-import.ts [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--data-dir <path>` | Path to data directory | `../data` |
| `--min-score <number>` | Minimum classification score | `7` |
| `--batch-size <number>` | Records per batch | `50` |
| `--limit <number>` | Max files to process | No limit |
| `--dry-run` | Preview without API calls | `false` |
| `--api-url <url>` | API endpoint | `http://localhost:3000` |

### Examples

**Test with 10 files (dry run)**
```bash
npm run import:test
# or
npx tsx scripts/export-and-import.ts --limit 10 --dry-run
```

**Import high-quality circuits only (score >= 9)**
```bash
npx tsx scripts/export-and-import.ts --min-score 9
```

**Import to production**
```bash
npx tsx scripts/export-and-import.ts \
  --api-url https://circuitsnips.mikeayles.com \
  --min-score 7 \
  --batch-size 50
```

**Use custom data directory**
```bash
npx tsx scripts/export-and-import.ts \
  --data-dir /path/to/data \
  --dry-run
```

### How It Works

1. **Connects to SQLite database** (`data/kicad_repos.db`)
2. **Queries for high-quality files**
   - Filters by `classification_score >= min-score`
   - Requires `classification_data` (AI classification results)
   - Requires `local_path` (schematic file location)
3. **Transforms data**
   - Reads actual `.kicad_sch` file content from disk
   - Extracts subcircuits from `classification_data` JSON
   - **Creates one circuit per subcircuit** (not per file)
   - Generates unique source IDs: `{file_id}-{subcircuit_index}`
4. **Sends batches to API**
   - Groups records into batches (default 50)
   - Sends POST requests with authentication
   - 1-second delay between batches (rate limiting)
5. **Tracks progress**
   - Real-time progress bar
   - Counts imported, skipped, failed
   - Logs errors for review

### Output

**During import:**
```
╔═══════════════════════════════════════════════════════════╗
║         CircuitSnips Batch Import Exporter               ║
╚═══════════════════════════════════════════════════════════╝

📁 Data directory:    C:\Users\mikea\...\data
🎯 Min score:         7
📦 Batch size:        50
🔗 API URL:           http://localhost:3000
🔐 API key:           ✓ Set
🏃 Mode:              LIVE

📂 Opening database: C:\Users\mikea\...\data\kicad_repos.db
🔍 Fetching records with score >= 7...
✅ Found 1247 files
🔄 Transforming data...
✅ Extracted 3856 subcircuits from 1247 files

📤 Sending 3856 records in batches of 50...

[████████████████████████████░░░░░░] 58% | Batch 45 | ✓ 2234 | ⊘ 12 | ✗ 0
```

**After completion:**
```
═══════════════════════════════════════════════════════════
📊 Import Complete!
═══════════════════════════════════════════════════════════
Files processed:       1247
Subcircuits extracted: 3856
Batches sent:          78
───────────────────────────────────────────────────────────
✅ Successfully imported: 3844
⊘  Skipped (duplicates): 12
❌ Failed:               0
═══════════════════════════════════════════════════════════
```

### Expected Numbers

Based on your scraper data:
- **Files with score >= 7**: ~1,200-1,500 files
- **Subcircuits extracted**: ~3,500-5,000 circuits
- **Average**: ~3 subcircuits per file
- **Import time**: ~5-10 minutes (with rate limiting)

### Duplicate Handling

The API automatically detects duplicates by slug:
- **Skipped**: Circuit with same slug already exists
- **Imported**: New circuit successfully added
- **Failed**: Validation or database error

Re-running the script is safe - it will skip existing circuits.

### Troubleshooting

**"Database not found"**
- Check `--data-dir` path
- Verify `kicad_repos.db` exists

**"ADMIN_API_KEY not set"**
```bash
export ADMIN_API_KEY="your-key-here"
```

**"No records found"**
- Lower `--min-score` threshold
- Check database has classified files
- Verify `classification_data` column is populated

**"Schematic file not found"**
- Verify `repos/` directory exists
- Check `local_path` in database matches actual files
- Files should be relative to `data/` directory

**High failure rate**
- Check API is running (`npm run dev`)
- Verify `BOT_USER_ID` is set
- Check database migration was applied
- Review error messages in API logs

### Advanced Usage

**Custom query (edit script)**

To customize which files are imported, edit the SQL query in `fetchRecords()`:

```typescript
const query = `
  SELECT ...
  WHERE f.classification_score >= ?
    AND f.classification_data IS NOT NULL
    AND r.license IN ('MIT', 'Apache-2.0')  -- Only these licenses
    AND r.stars > 100                       -- Popular repos only
  ORDER BY f.classification_score DESC
  LIMIT 1000
`;
```

**Resume after failure**

The API handles duplicates automatically, so just re-run:
```bash
npm run import
```

It will skip already-imported circuits and continue with new ones.

### Monitoring

**Check import progress in Supabase:**
```sql
-- View import batches
SELECT * FROM import_batches
ORDER BY started_at DESC
LIMIT 10;

-- View import statistics
SELECT * FROM get_import_stats();

-- View failed imports
SELECT * FROM import_records
WHERE status = 'error'
ORDER BY imported_at DESC;
```

**Check imported circuits:**
```sql
SELECT COUNT(*) FROM circuits;

SELECT title, slug, created_at
FROM circuits
ORDER BY created_at DESC
LIMIT 20;
```

### Next Steps

After successful import:

1. **Generate thumbnails** (separate process - TBD)
2. **Verify circuits** - Browse site to check quality
3. **Test search** - Ensure circuits are searchable
4. **Monitor engagement** - Track views, copies, favorites
5. **Iterate** - Adjust `min-score` threshold if needed

### Support

For issues:
1. Check API logs: `npm run dev` console output
2. Check import tracking: Supabase `import_batches` table
3. Review error messages in script output
4. Run with `--dry-run` to preview without changes
