# Batch Import Setup Guide

This guide explains how to set up and use the batch import API to populate CircuitSnips with circuits from external scrapers.

## Prerequisites

- Supabase project with CircuitSnips schema deployed
- Admin access to Supabase dashboard
- Node.js environment for generating API keys

## Step 1: Run Database Migration

1. Open Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql
2. Run the migration file: `supabase/migrations/batch-import-tracking.sql`
3. Verify tables created:
   - `import_batches`
   - `import_records`

## Step 2: Create Bot User Account

The bot user will be the owner of all imported circuits.

### Option A: Via Supabase Dashboard

1. Go to Authentication → Users
2. Click "Add user"
3. Fill in:
   - Email: `importer@circuitsnips.com` (or your domain)
   - Password: Generate a secure password (won't be used for login)
   - Auto Confirm User: ✅ Yes
4. Click "Create user"
5. Copy the user's UUID (you'll need this for `.env.local`)

### Option B: Via SQL

Run this in Supabase SQL Editor:

```sql
-- Insert bot user into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), -- This will be your BOT_USER_ID
  'authenticated',
  'authenticated',
  'importer@circuitsnips.com',
  crypt('change-this-password', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"user_name":"circuitsnips-importer"}',
  false,
  ''
)
RETURNING id; -- Copy this UUID!

-- The profile will be auto-created by the handle_new_user trigger
```

### Update Bot User Profile

After creating the user, update their profile:

```sql
UPDATE profiles
SET
  username = 'circuitsnips-importer',
  bio = 'Automated importer of open-source hardware circuits from GitHub. All circuits imported by this account are sourced from publicly available OSHW repositories.',
  website = 'https://circuitsnips.com/about',
  avatar_url = NULL
WHERE id = 'YOUR_BOT_USER_UUID';
```

## Step 3: Generate Admin API Key

Run this in Node.js or in your browser console:

```javascript
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('base64url');
console.log('Your Admin API Key:', apiKey);
```

Or use the built-in generator:

```bash
node -e "const { generateAdminKey } = require('./src/lib/admin-auth.ts'); console.log(generateAdminKey());"
```

**⚠️ IMPORTANT**: Store this key securely! It grants full import access.

## Step 4: Configure Environment Variables

Add to `.env.local`:

```env
# Batch Import Configuration
ADMIN_API_KEY="your_generated_api_key_here"
BOT_USER_ID="your_bot_user_uuid_here"
```

Add to Vercel environment variables (for production):

1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add both variables
3. Select "Production" and "Preview" environments
4. Click "Save"

## Step 5: Test the API

### Test with GET Request

```bash
curl https://circuitsnips.mikeayles.com/api/admin/batch-import
```

Should return API documentation.

### Test with Sample Import

Create a test file `test-import.json`:

```json
{
  "records": [
    {
      "source_file_id": "test-001",
      "repo_owner": "espressif",
      "repo_name": "esp32-board",
      "repo_url": "https://github.com/espressif/esp32-board",
      "repo_license": "Apache-2.0",
      "file_path": "hardware/main.kicad_sch",
      "raw_sexpr": "(kicad_sch (version 20231120) (generator \"test\") (uuid \"test-uuid\") (paper \"A4\") (lib_symbols) )",
      "component_count": 10,
      "classification_score": 8,
      "subcircuit": {
        "name": "Test Circuit",
        "description": "A test circuit for API validation",
        "tags": ["test", "validation"]
      }
    }
  ]
}
```

Send the request:

```bash
curl -X POST https://circuitsnips.mikeayles.com/api/admin/batch-import \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-import.json
```

Expected response:

```json
{
  "success": true,
  "batch_id": "batch-1706123456789",
  "results": {
    "total": 1,
    "imported": 1,
    "skipped": 0,
    "failed": 0
  },
  "details": [
    {
      "source_file_id": "test-001",
      "status": "success",
      "circuit_id": "uuid",
      "slug": "test-circuit-esp32-board"
    }
  ]
}
```

## Step 6: Exporter Implementation (For Scraper Side)

The scraper should export data in this format:

```javascript
// Example Node.js exporter
const fs = require('fs');
const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('data/kicad_repos.db');

const query = `
  SELECT
    f.id AS source_file_id,
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
  WHERE f.classification_score >= 7
  ORDER BY f.classification_score DESC
  LIMIT 100;
`;

db.all(query, (err, rows) => {
  if (err) throw err;

  const records = rows.map(row => {
    const classificationData = JSON.parse(row.classification_data);
    const rawSexpr = fs.readFileSync(row.local_path, 'utf8');

    // Process each subcircuit as a separate record
    return classificationData.subcircuits.map(subcircuit => ({
      source_file_id: `${row.source_file_id}-${subcircuit.name}`,
      repo_owner: row.repo_owner,
      repo_name: row.repo_name,
      repo_url: row.repo_url,
      repo_license: row.repo_license,
      file_path: row.file_path,
      raw_sexpr: rawSexpr,
      component_count: row.component_count,
      classification_score: row.classification_score,
      subcircuit: {
        name: subcircuit.name,
        description: subcircuit.description,
        components: subcircuit.components,
        useCase: subcircuit.useCase,
        notes: subcircuit.notes,
        tags: subcircuit.tags
      }
    }));
  }).flat();

  // Send in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    fetch('https://circuitsnips.mikeayles.com/api/admin/batch-import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: batch })
    })
    .then(res => res.json())
    .then(result => {
      console.log(`Batch ${i / batchSize + 1} result:`, result);
    })
    .catch(err => {
      console.error(`Batch ${i / batchSize + 1} error:`, err);
    });
  }
});
```

## Monitoring Imports

### View Import Statistics

```sql
SELECT * FROM get_import_stats();
```

### View Recent Batches

```sql
SELECT
  batch_id,
  total_records,
  imported_count,
  skipped_count,
  failed_count,
  status,
  started_at,
  completed_at
FROM import_batches
ORDER BY started_at DESC
LIMIT 10;
```

### View Failed Records

```sql
SELECT
  ir.source_file_id,
  ir.repo_owner,
  ir.repo_name,
  ir.error_message,
  ir.imported_at
FROM import_records ir
WHERE ir.status = 'error'
ORDER BY ir.imported_at DESC
LIMIT 50;
```

## Troubleshooting

### "Unauthorized" Error

- Verify `ADMIN_API_KEY` is set correctly in `.env.local` and Vercel
- Check Authorization header format: `Bearer YOUR_KEY`
- Ensure no extra spaces or quotes in the key

### "BOT_USER_ID not configured" Error

- Verify `BOT_USER_ID` is set in `.env.local` and Vercel
- Confirm the UUID matches the bot user in Supabase auth.users

### Duplicate Slug Errors

- This is expected for re-imports
- The API will skip duplicates and report them as "skipped"
- Check `import_records` table for details

### Validation Errors

- Review the error message in the response
- Common issues:
  - Missing required fields
  - Invalid S-expression format
  - Tags array empty or too long
  - Title exceeds 100 characters

## Security Best Practices

1. **Never commit** the `ADMIN_API_KEY` to version control
2. **Rotate the key** periodically (update both `.env.local` and Vercel)
3. **Monitor** import batches for unusual activity
4. **Restrict** bot user permissions if needed
5. **Use HTTPS** only for API requests

## Next Steps

After successful import:

1. Review imported circuits in Supabase dashboard
2. Generate thumbnails (separate process)
3. Verify attribution links work correctly
4. Test search functionality with imported circuits
5. Monitor user engagement with imported content
