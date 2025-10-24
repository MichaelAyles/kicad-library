-- Simplified Circuit Flags Migration
-- Allows anonymous flagging without authentication

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can flag circuits" ON public.circuit_flags;
DROP POLICY IF EXISTS "Users can view their own flags" ON public.circuit_flags;
DROP POLICY IF EXISTS "Admins can view all flags" ON public.circuit_flags;
DROP POLICY IF EXISTS "Admins can update flags" ON public.circuit_flags;

-- Drop the unique constraint that requires user ID
ALTER TABLE public.circuit_flags DROP CONSTRAINT IF EXISTS unique_user_circuit_flag;

-- Make flagged_by nullable (for anonymous flags)
ALTER TABLE public.circuit_flags ALTER COLUMN flagged_by DROP NOT NULL;

-- Keep RLS enabled but with permissive policies
ALTER TABLE public.circuit_flags ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to insert flags
CREATE POLICY "Anyone can flag circuits"
ON public.circuit_flags
FOR INSERT
WITH CHECK (true);

-- Allow anyone to view all flags (for checking if already flagged by IP, etc.)
CREATE POLICY "Anyone can view flags"
ON public.circuit_flags
FOR SELECT
USING (true);

-- Only authenticated admins can update flags
CREATE POLICY "Admins can update flags"
ON public.circuit_flags
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Only authenticated admins can delete flags
CREATE POLICY "Admins can delete flags"
ON public.circuit_flags
FOR DELETE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
