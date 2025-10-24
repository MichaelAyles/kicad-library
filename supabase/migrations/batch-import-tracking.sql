-- Batch Import Tracking Migration
-- Tracks batch import jobs and their metadata
-- Run this in Supabase SQL Editor

-- ============================================================================
-- IMPORT BATCHES TABLE
-- Tracks batch import operations for auditing and monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id TEXT UNIQUE NOT NULL, -- External batch identifier (e.g., "batch-1706123456789")

  -- Import metadata
  source_type TEXT NOT NULL DEFAULT 'github_scraper', -- Source of the data
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who initiated import
  bot_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Bot user account circuits were imported under

  -- Batch statistics
  total_records INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Status tracking
  status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Additional metadata (JSON)
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS import_batches_batch_id_idx ON public.import_batches(batch_id);
CREATE INDEX IF NOT EXISTS import_batches_status_idx ON public.import_batches(status);
CREATE INDEX IF NOT EXISTS import_batches_started_at_idx ON public.import_batches(started_at DESC);

-- ============================================================================
-- IMPORT RECORDS TABLE
-- Detailed tracking of individual records within batches
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.import_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Source identification
  source_file_id TEXT NOT NULL, -- ID from scraper database
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT,
  file_path TEXT,

  -- Import result
  status TEXT NOT NULL, -- 'success', 'skipped', 'error'
  circuit_id UUID REFERENCES public.circuits(id) ON DELETE SET NULL,
  slug TEXT,

  -- Error/skip details
  error_message TEXT,
  skip_reason TEXT,

  -- Timestamps
  imported_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_record_status CHECK (status IN ('success', 'skipped', 'error'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS import_records_batch_id_idx ON public.import_records(batch_id);
CREATE INDEX IF NOT EXISTS import_records_status_idx ON public.import_records(status);
CREATE INDEX IF NOT EXISTS import_records_source_file_id_idx ON public.import_records(source_file_id);
CREATE INDEX IF NOT EXISTS import_records_circuit_id_idx ON public.import_records(circuit_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_records ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view import tracking data
-- (In practice, this would be restricted to admins only)
DROP POLICY IF EXISTS "Import batches viewable by authenticated users" ON public.import_batches;
CREATE POLICY "Import batches viewable by authenticated users"
  ON public.import_batches FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Import records viewable by authenticated users" ON public.import_records;
CREATE POLICY "Import records viewable by authenticated users"
  ON public.import_records FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a new import batch
CREATE OR REPLACE FUNCTION create_import_batch(
  p_batch_id TEXT,
  p_total_records INTEGER,
  p_source_type TEXT DEFAULT 'github_scraper'
)
RETURNS UUID AS $$
DECLARE
  v_batch_uuid UUID;
BEGIN
  INSERT INTO public.import_batches (batch_id, total_records, source_type)
  VALUES (p_batch_id, p_total_records, p_source_type)
  RETURNING id INTO v_batch_uuid;

  RETURN v_batch_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to complete an import batch
CREATE OR REPLACE FUNCTION complete_import_batch(
  p_batch_id TEXT,
  p_imported INTEGER,
  p_skipped INTEGER,
  p_failed INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.import_batches
  SET
    imported_count = p_imported,
    skipped_count = p_skipped,
    failed_count = p_failed,
    status = CASE
      WHEN p_failed > 0 THEN 'completed'
      ELSE 'completed'
    END,
    completed_at = NOW()
  WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get import statistics
CREATE OR REPLACE FUNCTION get_import_stats()
RETURNS TABLE (
  total_batches BIGINT,
  total_imported BIGINT,
  total_skipped BIGINT,
  total_failed BIGINT,
  avg_batch_size NUMERIC,
  last_import_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_batches,
    COALESCE(SUM(imported_count), 0)::BIGINT as total_imported,
    COALESCE(SUM(skipped_count), 0)::BIGINT as total_skipped,
    COALESCE(SUM(failed_count), 0)::BIGINT as total_failed,
    COALESCE(AVG(total_records), 0)::NUMERIC as avg_batch_size,
    MAX(started_at) as last_import_date
  FROM public.import_batches;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Note: This migration is idempotent and can be run multiple times
-- All CREATE statements use IF NOT EXISTS or DROP IF EXISTS to avoid errors
