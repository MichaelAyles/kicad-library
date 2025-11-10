-- Migration: Add thumbnail_version column and performance indexes
-- Created: 2025-01-20
-- Purpose: Support thumbnail versioning and optimize thumbnail regeneration queries

-- ============================================================================
-- ADD THUMBNAIL VERSION COLUMN
-- ============================================================================

-- Add thumbnail_version column to circuits table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='thumbnail_version') THEN
    ALTER TABLE public.circuits ADD COLUMN thumbnail_version INTEGER DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN public.circuits.thumbnail_version IS 'Version number for thumbnail files (increments on regeneration)';
  END IF;
END $$;

-- ============================================================================
-- CREATE THUMBNAIL HISTORY TABLE
-- ============================================================================

-- Table to track thumbnail regeneration history
CREATE TABLE IF NOT EXISTS public.thumbnail_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  thumbnail_light_url TEXT NOT NULL,
  thumbnail_dark_url TEXT NOT NULL,
  regenerated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_current BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure version numbers are unique per circuit
  CONSTRAINT unique_circuit_version UNIQUE(circuit_id, version)
);

-- Index for querying history by circuit
CREATE INDEX IF NOT EXISTS thumbnail_history_circuit_id_idx
  ON public.thumbnail_history(circuit_id);

-- Index for finding current version
CREATE INDEX IF NOT EXISTS thumbnail_history_current_idx
  ON public.thumbnail_history(circuit_id, is_current)
  WHERE is_current = true;

-- Index for querying by regenerator
CREATE INDEX IF NOT EXISTS thumbnail_history_regenerated_by_idx
  ON public.thumbnail_history(regenerated_by);

-- ============================================================================
-- PERFORMANCE INDEXES FOR THUMBNAIL OPERATIONS
-- ============================================================================

-- Composite index for finding circuits without thumbnails (used by bulk regenerator)
-- This dramatically speeds up queries like: WHERE thumbnail_light_url IS NULL OR thumbnail_dark_url IS NULL
CREATE INDEX IF NOT EXISTS circuits_missing_thumbnails_idx
  ON public.circuits(user_id, id)
  WHERE thumbnail_light_url IS NULL OR thumbnail_dark_url IS NULL;

-- Index for circuits WITH thumbnails (for statistics queries)
CREATE INDEX IF NOT EXISTS circuits_with_thumbnails_idx
  ON public.circuits(user_id, id)
  WHERE thumbnail_light_url IS NOT NULL AND thumbnail_dark_url IS NOT NULL;

-- Index on thumbnail_version for concurrent update checks
CREATE INDEX IF NOT EXISTS circuits_thumbnail_version_idx
  ON public.circuits(id, thumbnail_version);

-- ============================================================================
-- ROW LEVEL SECURITY FOR THUMBNAIL HISTORY
-- ============================================================================

ALTER TABLE public.thumbnail_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view thumbnail history
DROP POLICY IF EXISTS "Anyone can view thumbnail history" ON public.thumbnail_history;
CREATE POLICY "Anyone can view thumbnail history"
  ON public.thumbnail_history
  FOR SELECT
  USING (true);

-- Only circuit owner or admin can insert history
DROP POLICY IF EXISTS "Circuit owner or admin can insert history" ON public.thumbnail_history;
CREATE POLICY "Circuit owner or admin can insert history"
  ON public.thumbnail_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circuits
      WHERE circuits.id = thumbnail_history.circuit_id
      AND circuits.user_id = auth.uid()
    )
  );

-- Only admins can update history
DROP POLICY IF EXISTS "Only admins can update history" ON public.thumbnail_history;
CREATE POLICY "Only admins can update history"
  ON public.thumbnail_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Only admins can delete history
DROP POLICY IF EXISTS "Only admins can delete history" ON public.thumbnail_history;
CREATE POLICY "Only admins can delete history"
  ON public.thumbnail_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.thumbnail_history IS 'Tracks thumbnail regeneration history with versioning';
COMMENT ON INDEX circuits_missing_thumbnails_idx IS 'Optimizes queries for circuits needing thumbnail regeneration';
COMMENT ON INDEX circuits_with_thumbnails_idx IS 'Optimizes statistics queries for circuits with thumbnails';
COMMENT ON INDEX circuits_thumbnail_version_idx IS 'Optimizes concurrent version increment operations';
