# Supabase Migrations

This directory contains SQL migration files for the CircuitSnips database.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste and execute

### Option 2: Supabase CLI
```bash
supabase db push
```

## Migration Files

### `add_global_stats.sql`
**Created:** 2025-01-20
**Purpose:** Add global stats counter for homepage performance optimization

**What it does:**
- Creates `global_stats` table (single-row table)
- Updates `increment_circuit_copies()` to increment global counter
- Adds triggers to auto-update circuit/user counts
- Adds `sync_global_stats()` function for manual recalculation
- Populates initial data from existing tables

**Impact:**
- Homepage stats queries change from O(n) aggregation to O(1) lookup
- Massive performance improvement for sites with many circuits
- Stats are automatically maintained going forward
- Manual sync available in admin panel

**Rollback:**
If needed, you can revert by:
```sql
DROP TABLE IF EXISTS public.global_stats CASCADE;
-- And restore the old increment_circuit_copies function
```

## Important Notes

- Migrations are idempotent (safe to run multiple times)
- Always backup your database before running migrations
- Test migrations on a staging environment first
- The global_stats table uses a CHECK constraint to ensure only one row (id=1)
