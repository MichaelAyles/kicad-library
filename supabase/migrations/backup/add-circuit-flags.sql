-- Circuit Flags Migration
-- Allows users to flag circuits for review/removal

-- ============================================================================
-- CIRCUIT_FLAGS TABLE
-- Tracks user reports/flags for inappropriate circuits
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circuit_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Circuit and user relationships
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Flag details
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate_content',
    'copyright_violation',
    'spam',
    'broken_circuit',
    'duplicate',
    'other'
  )),
  details TEXT, -- Optional additional details from user

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT, -- Notes from admin/moderator

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate flags from same user
  CONSTRAINT unique_user_circuit_flag UNIQUE(circuit_id, flagged_by)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS circuit_flags_circuit_id_idx ON public.circuit_flags(circuit_id);
CREATE INDEX IF NOT EXISTS circuit_flags_flagged_by_idx ON public.circuit_flags(flagged_by);
CREATE INDEX IF NOT EXISTS circuit_flags_status_idx ON public.circuit_flags(status);
CREATE INDEX IF NOT EXISTS circuit_flags_created_at_idx ON public.circuit_flags(created_at DESC);

-- RLS Policies
ALTER TABLE public.circuit_flags ENABLE ROW LEVEL SECURITY;

-- Users can create flags
CREATE POLICY "Users can flag circuits" ON public.circuit_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = flagged_by);

-- Users can view their own flags
CREATE POLICY "Users can view their own flags" ON public.circuit_flags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = flagged_by);

-- Admin/moderators can view all flags (will be restricted by role in future)
CREATE POLICY "Admins can view all flags" ON public.circuit_flags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Admin/moderators can update flags
CREATE POLICY "Admins can update flags" ON public.circuit_flags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_circuit_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER circuit_flags_updated_at
  BEFORE UPDATE ON public.circuit_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_circuit_flags_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get flag count for a circuit
CREATE OR REPLACE FUNCTION get_circuit_flag_count(circuit_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.circuit_flags
  WHERE circuit_id = circuit_uuid
  AND status = 'pending';
$$ LANGUAGE SQL STABLE;

-- Check if user has flagged a circuit
CREATE OR REPLACE FUNCTION has_user_flagged_circuit(circuit_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circuit_flags
    WHERE circuit_id = circuit_uuid
    AND flagged_by = user_uuid
  );
$$ LANGUAGE SQL STABLE;

-- Get pending flags summary (for admin dashboard)
CREATE OR REPLACE FUNCTION get_pending_flags_summary()
RETURNS TABLE (
  total_pending BIGINT,
  total_reviewed BIGINT,
  total_resolved BIGINT,
  total_dismissed BIGINT
) AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
    COUNT(*) FILTER (WHERE status = 'reviewed') as total_reviewed,
    COUNT(*) FILTER (WHERE status = 'resolved') as total_resolved,
    COUNT(*) FILTER (WHERE status = 'dismissed') as total_dismissed
  FROM public.circuit_flags;
$$ LANGUAGE SQL STABLE;

-- Comments
COMMENT ON TABLE public.circuit_flags IS 'User-reported flags for circuit content moderation';
COMMENT ON COLUMN public.circuit_flags.reason IS 'Predefined reason categories for flagging';
COMMENT ON COLUMN public.circuit_flags.status IS 'Current state of the flag in moderation workflow';
COMMENT ON COLUMN public.circuit_flags.details IS 'Optional user-provided additional context';
COMMENT ON COLUMN public.circuit_flags.admin_notes IS 'Internal notes from moderators/admins';
