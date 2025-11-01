-- Migration: Add global_stats table for efficient homepage stats
-- Created: 2025-01-20
-- Purpose: Replace expensive aggregation queries with a single-row lookup

-- ============================================================================
-- GLOBAL STATS TABLE
-- Single row table for tracking global statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.global_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure only one row
  total_circuits INTEGER DEFAULT 0,
  total_copies INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial row with current counts
INSERT INTO public.global_stats (id, total_circuits, total_copies, total_users, last_synced_at)
VALUES (1, 0, 0, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FUNCTION: Sync global stats from actual data
-- Recalculates all stats from source tables
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_global_stats()
RETURNS VOID AS $$
DECLARE
  v_circuit_count INTEGER;
  v_copy_count INTEGER;
  v_user_count INTEGER;
BEGIN
  -- Count public circuits
  SELECT COUNT(*) INTO v_circuit_count
  FROM public.circuits
  WHERE is_public = true;

  -- Sum all copy counts (PostgreSQL will handle all rows efficiently)
  SELECT COALESCE(SUM(c.copy_count), 0) INTO v_copy_count
  FROM public.circuits c
  WHERE c.is_public = true;

  -- Count all users
  SELECT COUNT(*) INTO v_user_count
  FROM public.profiles;

  -- Update global stats
  UPDATE public.global_stats
  SET
    total_circuits = v_circuit_count,
    total_copies = v_copy_count,
    total_users = v_user_count,
    last_synced_at = NOW(),
    updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED: Increment copy count function
-- Now also increments global counter
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_circuit_copies(circuit_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Increment circuit-specific count
  UPDATE public.circuits
  SET copy_count = copy_count + 1
  WHERE id = circuit_id;

  -- Increment global count
  UPDATE public.global_stats
  SET
    total_copies = total_copies + 1,
    updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-update circuit count on circuit insert/delete
-- ============================================================================
CREATE OR REPLACE FUNCTION update_global_circuit_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_public = true THEN
    UPDATE public.global_stats
    SET
      total_circuits = total_circuits + 1,
      updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'DELETE' AND OLD.is_public = true THEN
    UPDATE public.global_stats
    SET
      total_circuits = total_circuits - 1,
      updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle is_public flag changes
    IF OLD.is_public = false AND NEW.is_public = true THEN
      UPDATE public.global_stats
      SET
        total_circuits = total_circuits + 1,
        updated_at = NOW()
      WHERE id = 1;
    ELSIF OLD.is_public = true AND NEW.is_public = false THEN
      UPDATE public.global_stats
      SET
        total_circuits = total_circuits - 1,
        updated_at = NOW()
      WHERE id = 1;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS global_circuit_count_trigger ON public.circuits;
CREATE TRIGGER global_circuit_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION update_global_circuit_count();

-- ============================================================================
-- TRIGGER: Auto-update user count on profile insert/delete
-- ============================================================================
CREATE OR REPLACE FUNCTION update_global_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.global_stats
    SET
      total_users = total_users + 1,
      updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.global_stats
    SET
      total_users = total_users - 1,
      updated_at = NOW()
    WHERE id = 1;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS global_user_count_trigger ON public.profiles;
CREATE TRIGGER global_user_count_trigger
  AFTER INSERT OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_global_user_count();

-- ============================================================================
-- Initial sync to populate with current data
-- ============================================================================
SELECT sync_global_stats();
