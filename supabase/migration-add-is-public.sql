-- Add is_public column and make file_path optional for MVP
-- Run this in Supabase SQL Editor

-- Add is_public column (defaults to true for now, we can add private circuits later)
ALTER TABLE public.circuits
ADD COLUMN is_public BOOLEAN DEFAULT true;

-- Make file_path optional (nullable) since we're storing raw_sexpr directly
ALTER TABLE public.circuits
ALTER COLUMN file_path DROP NOT NULL;

-- Add thumbnail URL columns for storing thumbnails from Supabase Storage
ALTER TABLE public.circuits
ADD COLUMN thumbnail_light_url TEXT,
ADD COLUMN thumbnail_dark_url TEXT;

-- Add index for filtering public circuits
CREATE INDEX circuits_is_public_idx ON public.circuits(is_public) WHERE is_public = true;

-- Update RLS policy to only show public circuits (for now)
-- Drop the old policy
DROP POLICY IF EXISTS "Circuits are viewable by everyone" ON public.circuits;

-- Create new policy that shows public circuits OR user's own circuits
CREATE POLICY "Public circuits and own circuits are viewable"
  ON public.circuits FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
