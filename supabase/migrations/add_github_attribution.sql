-- Add github_owner and github_repo fields to circuits table
-- These fields store GitHub attribution for imported circuits

DO $$
BEGIN
  -- Add github_owner column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='github_owner') THEN
    ALTER TABLE public.circuits ADD COLUMN github_owner TEXT;
    RAISE NOTICE 'Added github_owner column';
  ELSE
    RAISE NOTICE 'Column github_owner already exists';
  END IF;

  -- Add github_repo column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='github_repo') THEN
    ALTER TABLE public.circuits ADD COLUMN github_repo TEXT;
    RAISE NOTICE 'Added github_repo column';
  ELSE
    RAISE NOTICE 'Column github_repo already exists';
  END IF;
END $$;

-- Create index for github_owner lookups
CREATE INDEX IF NOT EXISTS circuits_github_owner_idx ON public.circuits(github_owner) WHERE github_owner IS NOT NULL;

COMMENT ON COLUMN public.circuits.github_owner IS 'GitHub username of original repo owner (for imported circuits)';
COMMENT ON COLUMN public.circuits.github_repo IS 'GitHub repository name (for imported circuits)';
