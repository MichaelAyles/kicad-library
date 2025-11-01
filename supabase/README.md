# Supabase Database Setup

## Quick Start

**One file, one command - that's it!**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Copy the entire contents of `setup.sql`
4. Paste and click **Run**
5. Done! ✨

## What Gets Created

The `setup.sql` script creates everything you need:

- ✅ **All Tables**: profiles, circuits, components, comments, favorites, flags, batches, global_stats
- ✅ **Indexes**: Optimized for search and performance
- ✅ **Full-Text Search**: Weighted rankings (tags > title > description)
- ✅ **Row Level Security**: Comprehensive policies for data access
- ✅ **Storage Buckets**: circuits, thumbnails, previews
- ✅ **Triggers**: Auto-update counters and stats
- ✅ **Functions**: Search, increment, sync operations
- ✅ **Global Stats**: Super-fast homepage with single-row lookup

## File Structure

```
supabase/
├── setup.sql              # ⭐ THE ONE FILE - Run this!
├── schema.sql             # Main schema (not used, kept for reference)
├── schema.sql.backup      # Backup of old schema
└── migrations/
    └── backup/            # Old migrations (archived)
        ├── add_global_stats.sql
        ├── add-circuit-flags.sql
        ├── batch-import-tracking.sql
        └── ... (other historical migrations)
```

## Key Features

### Global Stats Tracking
The database now uses a single-row `global_stats` table for super-fast homepage performance:
- Automatically updated via triggers
- Manual sync available via `SELECT sync_global_stats();`
- Powers the homepage without expensive aggregations

### Idempotent Design
- Safe to run `setup.sql` multiple times
- All statements use `IF NOT EXISTS` or `CREATE OR REPLACE`
- Won't break existing data

### Comprehensive RLS
- Public circuits visible to everyone
- Users can manage their own content
- Anonymous flagging supported
- Admin-only batch imports

## Troubleshooting

### If You Need to Start Fresh
```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then run setup.sql again
```

### If Stats Are Out of Sync
```sql
SELECT sync_global_stats();
```

Or use the admin panel:
1. Log in as admin
2. Go to `/admin`
3. Click "Global Stats" tab
4. Click "Sync Stats" button

## Version History

- **2025-01-20**: Consolidated all migrations into single `setup.sql`
- Previous migrations archived in `migrations/backup/`

## Need Help?

See the main project README or check [Supabase Documentation](https://supabase.com/docs).
