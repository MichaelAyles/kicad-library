-- ============================================================================
-- CircuitSnips Database Setup Script
-- ============================================================================
--
-- COMPLETE DATABASE SETUP - ONE FILE TO RULE THEM ALL
--
-- Run this script ONCE in your Supabase SQL Editor to create everything:
--   ✓ All tables and relationships
--   ✓ Indexes for performance
--   ✓ Full-text search with weighted rankings (tags > title > description)
--   ✓ Row Level Security policies
--   ✓ Storage buckets for files/thumbnails
--   ✓ Automatic triggers for counters
--   ✓ Global stats tracking (super-fast homepage)
--   ✓ Helper functions and admin features
--
-- This script is IDEMPOTENT - safe to run multiple times
-- All statements use IF NOT EXISTS or CREATE OR REPLACE
--
-- Version: 2025-01-20
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Extends auth.users with public profile information
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  github_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Try to extract username from GitHub OAuth metadata
  -- GitHub provides: user_name, preferred_username, or login
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.raw_user_meta_data->>'login',
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  -- Sanitize username to match our constraints (alphanumeric, dash, underscore)
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_-]', '', 'g');

  -- Ensure minimum length
  IF char_length(base_username) < 3 THEN
    base_username := 'user_' || substring(NEW.id::text from 1 for 8);
  END IF;

  final_username := base_username;

  -- Handle duplicate usernames with atomic retry logic
  -- This prevents race conditions by using exception handling
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, avatar_url, github_url)
      VALUES (
        NEW.id,
        final_username,
        NEW.raw_user_meta_data->>'avatar_url',
        CASE
          WHEN NEW.raw_user_meta_data->>'user_name' IS NOT NULL
          THEN 'https://github.com/' || (NEW.raw_user_meta_data->>'user_name')
          ELSE NULL
        END
      );
      -- Success - exit loop
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      -- Username already taken, try with a counter
      counter := counter + 1;
      IF counter > 100 THEN
        RAISE EXCEPTION 'Could not generate unique username after 100 attempts for user %', NEW.id;
      END IF;
      final_username := base_username || '_' || counter;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- CIRCUITS TABLE
-- Main table for storing circuit metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Storage paths
  file_path TEXT, -- Path in Supabase Storage (optional - we store raw_sexpr directly)
  raw_sexpr TEXT NOT NULL, -- Raw S-expression data (for quick access)

  -- Metadata from S-expression parsing
  component_count INTEGER DEFAULT 0,
  wire_count INTEGER DEFAULT 0,
  net_count INTEGER DEFAULT 0,

  -- Categorization
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  license TEXT DEFAULT 'CERN-OHL-S-2.0',

  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Visibility
  is_public BOOLEAN DEFAULT true,

  -- Thumbnail URLs (stored in Supabase Storage)
  thumbnail_light_url TEXT,
  thumbnail_dark_url TEXT,
  thumbnail_version INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='is_public') THEN
    ALTER TABLE public.circuits ADD COLUMN is_public BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='thumbnail_light_url') THEN
    ALTER TABLE public.circuits ADD COLUMN thumbnail_light_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='thumbnail_dark_url') THEN
    ALTER TABLE public.circuits ADD COLUMN thumbnail_dark_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='thumbnail_version') THEN
    ALTER TABLE public.circuits ADD COLUMN thumbnail_version INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='comment_count') THEN
    ALTER TABLE public.circuits ADD COLUMN comment_count INTEGER DEFAULT 0;
  END IF;

  -- Make file_path nullable if not already
  BEGIN
    ALTER TABLE public.circuits ALTER COLUMN file_path DROP NOT NULL;
  EXCEPTION
    WHEN others THEN NULL; -- Ignore if already nullable
  END;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS circuits_user_id_idx ON public.circuits(user_id);
CREATE INDEX IF NOT EXISTS circuits_created_at_idx ON public.circuits(created_at DESC);
CREATE INDEX IF NOT EXISTS circuits_tags_idx ON public.circuits USING GIN(tags);
CREATE INDEX IF NOT EXISTS circuits_category_idx ON public.circuits(category);
CREATE INDEX IF NOT EXISTS circuits_is_public_idx ON public.circuits(is_public) WHERE is_public = true;

-- Full-text search column and index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='search_vector') THEN
    ALTER TABLE public.circuits ADD COLUMN search_vector tsvector;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS circuits_search_idx ON public.circuits USING GIN(search_vector);

-- Function to update search vector
-- Weights: Tags (A - highest), Title (B - medium), Description (C - lowest)
CREATE OR REPLACE FUNCTION update_circuit_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS update_circuit_search_trigger ON public.circuits;
CREATE TRIGGER update_circuit_search_trigger
  BEFORE INSERT OR UPDATE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION update_circuit_search_vector();

-- ============================================================================
-- CIRCUIT COMPONENTS
-- Detailed component information extracted from schematic
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuit_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  reference TEXT NOT NULL, -- e.g., "R1", "IC19"
  value TEXT NOT NULL, -- e.g., "10k", "TPIC8101DWRG4"
  footprint TEXT, -- e.g., "Resistor_SMD:R_0805_2012Metric"
  lib_id TEXT NOT NULL, -- e.g., "Device:R", "SamacSys_Parts:TPIC8101DWRG4"
  uuid TEXT NOT NULL,
  position_x FLOAT,
  position_y FLOAT,
  rotation FLOAT DEFAULT 0,

  UNIQUE(circuit_id, uuid)
);

CREATE INDEX IF NOT EXISTS circuit_components_circuit_id_idx ON public.circuit_components(circuit_id);
CREATE INDEX IF NOT EXISTS circuit_components_lib_id_idx ON public.circuit_components(lib_id);

-- ============================================================================
-- FAVORITES
-- Track which users favorited which circuits
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, circuit_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_circuit_id_idx ON public.favorites(circuit_id);

-- Update favorite_count when favorites change
CREATE OR REPLACE FUNCTION update_circuit_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuits
    SET favorite_count = favorite_count + 1
    WHERE id = NEW.circuit_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuits
    SET favorite_count = favorite_count - 1
    WHERE id = OLD.circuit_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_favorite_count_trigger ON public.favorites;
CREATE TRIGGER update_favorite_count_trigger
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION update_circuit_favorite_count();

-- ============================================================================
-- THUMBNAIL HISTORY
-- Track all thumbnail versions for audit trail and rollback capability
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.thumbnail_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  thumbnail_light_url TEXT NOT NULL,
  thumbnail_dark_url TEXT NOT NULL,
  regenerated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  regenerated_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE,
  notes TEXT,

  UNIQUE(circuit_id, version)
);

CREATE INDEX IF NOT EXISTS thumbnail_history_circuit_id_idx ON public.thumbnail_history(circuit_id);
CREATE INDEX IF NOT EXISTS thumbnail_history_current_idx ON public.thumbnail_history(circuit_id, is_current) WHERE is_current = TRUE;

-- ============================================================================
-- COPY TRACKING
-- Track when users copy circuits to their clipboard
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuit_copies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Allow anonymous copies
  copied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circuit_copies_circuit_id_idx ON public.circuit_copies(circuit_id);

-- ============================================================================
-- CIRCUIT COMMENTS
-- Supports threaded replies via parent_comment_id
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuit_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.circuit_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT false,

  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS circuit_comments_circuit_id_idx ON public.circuit_comments(circuit_id);
CREATE INDEX IF NOT EXISTS circuit_comments_user_id_idx ON public.circuit_comments(user_id);
CREATE INDEX IF NOT EXISTS circuit_comments_parent_id_idx ON public.circuit_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS circuit_comments_created_at_idx ON public.circuit_comments(created_at DESC);

-- ============================================================================
-- COMMENT LIKES
-- Track which users liked which comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.circuit_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON public.comment_likes(user_id);

-- ============================================================================
-- TRIGGERS FOR COMMENTS
-- ============================================================================

-- Update likes_count when comment_likes change
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuit_comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuit_comments
    SET likes_count = likes_count - 1
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comment_likes_count_trigger ON public.comment_likes;
CREATE TRIGGER update_comment_likes_count_trigger
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comment_updated_at ON public.circuit_comments;
CREATE TRIGGER update_comment_updated_at
  BEFORE UPDATE ON public.circuit_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION update_comment_updated_at_column();

-- Function to update circuit comment count
CREATE OR REPLACE FUNCTION update_circuit_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuits
    SET comment_count = comment_count + 1
    WHERE id = NEW.circuit_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuits
    SET comment_count = comment_count - 1
    WHERE id = OLD.circuit_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_circuit_comment_count_trigger ON public.circuit_comments;
CREATE TRIGGER update_circuit_comment_count_trigger
  AFTER INSERT OR DELETE ON public.circuit_comments
  FOR EACH ROW EXECUTE FUNCTION update_circuit_comment_count();


-- ============================================================================
-- CIRCUIT FLAGS
-- Allows users to flag circuits for review/removal  
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuit_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate_content',
    'copyright_violation',
    'spam',
    'inaccurate_data',
    'other'
  )),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circuit_flags_circuit_id_idx ON public.circuit_flags(circuit_id);
CREATE INDEX IF NOT EXISTS circuit_flags_status_idx ON public.circuit_flags(status);
CREATE INDEX IF NOT EXISTS circuit_flags_created_at_idx ON public.circuit_flags(created_at DESC);

-- ============================================================================
-- BATCH IMPORT TRACKING
-- Tracks batch import operations for auditing and monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'github_scraper',
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bot_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_records INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'partial')),
  error_log TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_batches_batch_id_idx ON public.import_batches(batch_id);
CREATE INDEX IF NOT EXISTS import_batches_status_idx ON public.import_batches(status);
CREATE INDEX IF NOT EXISTS import_batches_started_at_idx ON public.import_batches(started_at DESC);

-- Add batch_import_id to circuits if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='circuits' AND column_name='batch_import_id') THEN
    ALTER TABLE public.circuits ADD COLUMN batch_import_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS circuits_batch_import_id_idx ON public.circuits(batch_import_id);

-- ============================================================================
-- GLOBAL STATS
-- Single-row table for efficient homepage statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.global_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
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
-- GLOBAL STATS FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to sync global stats from actual data
CREATE OR REPLACE FUNCTION sync_global_stats()
RETURNS VOID AS $$
DECLARE
  v_circuit_count INTEGER;
  v_copy_count INTEGER;
  v_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_circuit_count
  FROM public.circuits
  WHERE is_public = true;

  SELECT COALESCE(SUM(c.copy_count), 0) INTO v_copy_count
  FROM public.circuits c
  WHERE c.is_public = true;

  SELECT COUNT(*) INTO v_user_count
  FROM public.profiles;

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

-- Trigger to auto-update circuit count
CREATE OR REPLACE FUNCTION update_global_circuit_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_public = true THEN
    UPDATE public.global_stats
    SET total_circuits = total_circuits + 1, updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'DELETE' AND OLD.is_public = true THEN
    UPDATE public.global_stats
    SET total_circuits = total_circuits - 1, updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_public = false AND NEW.is_public = true THEN
      UPDATE public.global_stats
      SET total_circuits = total_circuits + 1, updated_at = NOW()
      WHERE id = 1;
    ELSIF OLD.is_public = true AND NEW.is_public = false THEN
      UPDATE public.global_stats
      SET total_circuits = total_circuits - 1, updated_at = NOW()
      WHERE id = 1;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS global_circuit_count_trigger ON public.circuits;
CREATE TRIGGER global_circuit_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION update_global_circuit_count();

-- Trigger to auto-update user count
CREATE OR REPLACE FUNCTION update_global_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.global_stats
    SET total_users = total_users + 1, updated_at = NOW()
    WHERE id = 1;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.global_stats
    SET total_users = total_users - 1, updated_at = NOW()
    WHERE id = 1;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS global_user_count_trigger ON public.profiles;
CREATE TRIGGER global_user_count_trigger
  AFTER INSERT OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_global_user_count();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, users can update own profile
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Circuits: Public circuits viewable by everyone, users can see own private circuits
DROP POLICY IF EXISTS "Circuits are viewable by everyone" ON public.circuits;
DROP POLICY IF EXISTS "Public circuits and own circuits are viewable" ON public.circuits;
CREATE POLICY "Public circuits and own circuits are viewable"
  ON public.circuits FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create circuits" ON public.circuits;
CREATE POLICY "Authenticated users can create circuits"
  ON public.circuits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own circuits" ON public.circuits;
CREATE POLICY "Users can update own circuits"
  ON public.circuits FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own circuits" ON public.circuits;
CREATE POLICY "Users can delete own circuits"
  ON public.circuits FOR DELETE
  USING (auth.uid() = user_id);

-- Circuit Components: Same as circuits
DROP POLICY IF EXISTS "Components are viewable by everyone" ON public.circuit_components;
CREATE POLICY "Components are viewable by everyone"
  ON public.circuit_components FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Circuit owners can manage components" ON public.circuit_components;
CREATE POLICY "Circuit owners can manage components"
  ON public.circuit_components FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.circuits
      WHERE circuits.id = circuit_components.circuit_id
      AND circuits.user_id = auth.uid()
    )
  );

-- Favorites: Users can manage their own favorites
DROP POLICY IF EXISTS "Users can view all favorites" ON public.favorites;
CREATE POLICY "Users can view all favorites"
  ON public.favorites FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = user_id);

-- Circuit Copies: Anyone can insert, users can view own
DROP POLICY IF EXISTS "Anyone can record a copy" ON public.circuit_copies;
CREATE POLICY "Anyone can record a copy"
  ON public.circuit_copies FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own copies" ON public.circuit_copies;
CREATE POLICY "Users can view own copies"
  ON public.circuit_copies FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Comments: Everyone can read, authenticated users can create, owners can update/delete
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.circuit_comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.circuit_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.circuit_comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.circuit_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.circuit_comments;
CREATE POLICY "Users can update own comments"
  ON public.circuit_comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.circuit_comments;
CREATE POLICY "Users can delete own comments"
  ON public.circuit_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Comment Likes: Users can manage their own likes
DROP POLICY IF EXISTS "Users can view all comment likes" ON public.comment_likes;
CREATE POLICY "Users can view all comment likes"
  ON public.comment_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users can manage own comment likes"
  ON public.comment_likes FOR ALL
  USING (auth.uid() = user_id);

-- Circuit Flags: Anyone can flag, admins can view all
ALTER TABLE public.circuit_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can flag circuits" ON public.circuit_flags;
CREATE POLICY "Anyone can flag circuits"
  ON public.circuit_flags FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own flags" ON public.circuit_flags;
CREATE POLICY "Users can view own flags"
  ON public.circuit_flags FOR SELECT
  USING (auth.uid() = flagged_by);

-- Batch Imports: Only admins (handled via API)
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage imports" ON public.import_batches;
CREATE POLICY "Service role can manage imports"
  ON public.import_batches FOR ALL
  USING (auth.role() = 'service_role');

-- Global Stats: Public read, no direct writes (use functions)
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view stats" ON public.global_stats;
CREATE POLICY "Everyone can view stats"
  ON public.global_stats FOR SELECT
  USING (true);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create circuits bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('circuits', 'circuits', true)
ON CONFLICT (id) DO NOTHING;

-- Create thumbnails bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Create previews bucket (for temporary upload flow previews)
INSERT INTO storage.buckets (id, name, public)
VALUES ('previews', 'previews', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for circuits storage
DROP POLICY IF EXISTS "Anyone can view circuit files" ON storage.objects;
CREATE POLICY "Anyone can view circuit files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'circuits');

DROP POLICY IF EXISTS "Authenticated users can upload circuit files" ON storage.objects;
CREATE POLICY "Authenticated users can upload circuit files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'circuits' AND
    auth.role() = 'authenticated' AND
    -- Ensure files are stored in user's own folder: {user_id}/filename
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own circuit files" ON storage.objects;
CREATE POLICY "Users can update own circuit files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'circuits' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own circuit files" ON storage.objects;
CREATE POLICY "Users can delete own circuit files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'circuits' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for thumbnails storage
DROP POLICY IF EXISTS "Anyone can view thumbnails" ON storage.objects;
CREATE POLICY "Anyone can view thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails' AND
    auth.role() = 'authenticated' AND
    -- Ensure thumbnails are stored in user's own folder: {user_id}/filename
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own thumbnails" ON storage.objects;
CREATE POLICY "Users can update own thumbnails"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'thumbnails' AND
    auth.role() = 'authenticated' AND
    -- Only allow updating own thumbnails
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;
CREATE POLICY "Users can delete own thumbnails"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'thumbnails' AND
    auth.role() = 'authenticated' AND
    -- Only allow deleting own thumbnails
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for previews storage (temporary upload previews)
DROP POLICY IF EXISTS "Anyone can view previews" ON storage.objects;
CREATE POLICY "Anyone can view previews"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'previews');

DROP POLICY IF EXISTS "Authenticated users can upload previews" ON storage.objects;
CREATE POLICY "Authenticated users can upload previews"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'previews' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Authenticated users can update previews" ON storage.objects;
CREATE POLICY "Authenticated users can update previews"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'previews' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Anyone can delete old previews" ON storage.objects;
CREATE POLICY "Anyone can delete old previews"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'previews');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment view count (atomic operation to prevent race conditions)
CREATE OR REPLACE FUNCTION increment_circuit_views(circuit_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.circuits
  SET view_count = view_count + 1
  WHERE id = circuit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment copy count (atomic operation to prevent race conditions)
-- Also increments global counter for homepage stats
CREATE OR REPLACE FUNCTION increment_circuit_copies(circuit_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Increment circuit-specific count
  UPDATE public.circuits
  SET copy_count = copy_count + 1
  WHERE id = circuit_id;

  -- Increment global count
  UPDATE public.global_stats
  SET total_copies = total_copies + 1, updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search circuits (basic version - kept for backward compatibility)
CREATE OR REPLACE FUNCTION search_circuits(search_query TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title,
    c.description,
    ts_rank(c.search_vector, plainto_tsquery('english', search_query)) as rank
  FROM public.circuits c
  WHERE c.search_vector @@ plainto_tsquery('english', search_query)
  AND c.is_public = true
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive weighted search function with filters
-- Weights: Tags (A/highest), Title (B/medium), Description (C/lowest)
CREATE OR REPLACE FUNCTION search_circuits_weighted(
  search_query TEXT,
  filter_category TEXT DEFAULT NULL,
  filter_tag TEXT DEFAULT NULL,
  filter_license TEXT DEFAULT NULL,
  exclude_user_id UUID DEFAULT NULL,
  result_limit INT DEFAULT 50,
  result_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  tags TEXT[],
  category TEXT,
  license TEXT,
  thumbnail_light_url TEXT,
  thumbnail_dark_url TEXT,
  view_count INTEGER,
  copy_count INTEGER,
  favorite_count INTEGER,
  created_at TIMESTAMPTZ,
  profiles JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title,
    c.description,
    c.tags,
    c.category,
    c.license,
    c.thumbnail_light_url,
    c.thumbnail_dark_url,
    c.view_count,
    c.copy_count,
    c.favorite_count,
    c.created_at,
    json_build_object(
      'username', p.username,
      'avatar_url', p.avatar_url
    ) as profiles
  FROM public.circuits c
  LEFT JOIN public.profiles p ON c.user_id = p.id
  WHERE
    c.is_public = true
    -- Full-text search on weighted search_vector OR pattern matching for exact/partial matches
    AND (
      -- Full-text search using weighted vector
      c.search_vector @@ plainto_tsquery('english', search_query)
      OR
      -- Pattern matching for title
      c.title ILIKE '%' || search_query || '%'
      OR
      -- Exact tag match
      search_query = ANY(c.tags)
      OR
      -- Partial tag match (e.g., "atsamd" matches "atsamd21")
      EXISTS (
        SELECT 1 FROM unnest(c.tags) AS tag
        WHERE tag ILIKE '%' || search_query || '%'
      )
      OR
      -- Pattern matching for description
      c.description ILIKE '%' || search_query || '%'
    )
    -- Category filter
    AND (filter_category IS NULL OR c.category = filter_category)
    -- Tag filter
    AND (filter_tag IS NULL OR filter_tag = ANY(c.tags))
    -- License filter
    AND (filter_license IS NULL OR c.license = filter_license)
    -- Exclude user filter
    AND (exclude_user_id IS NULL OR c.user_id != exclude_user_id)
  ORDER BY
    -- Custom weighted ranking:
    -- 1. Exact tag match (highest priority)
    CASE WHEN search_query = ANY(c.tags) THEN 1000 ELSE 0 END DESC,
    -- 2. Partial tag match (e.g., "atsamd" in "atsamd21")
    CASE WHEN EXISTS (
      SELECT 1 FROM unnest(c.tags) AS tag
      WHERE tag ILIKE '%' || search_query || '%'
    ) THEN 800 ELSE 0 END DESC,
    -- 3. Exact title match
    CASE WHEN c.title ILIKE search_query THEN 500 ELSE 0 END DESC,
    -- 4. Title contains query
    CASE WHEN c.title ILIKE '%' || search_query || '%' THEN 250 ELSE 0 END DESC,
    -- 5. Full-text search rank (uses weighted search_vector: tags=A, title=B, description=C)
    ts_rank(c.search_vector, plainto_tsquery('english', search_query)) DESC,
    -- 6. Copy count as tiebreaker
    c.copy_count DESC NULLS LAST
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- INITIAL DATA SYNC
-- ============================================================================

-- Populate global_stats with current counts
SELECT sync_global_stats();

-- Migrate existing circuits to thumbnail versioning (v1)
-- Create history records for circuits that have thumbnails but no history
INSERT INTO public.thumbnail_history (circuit_id, version, thumbnail_light_url, thumbnail_dark_url, is_current, regenerated_at, notes)
SELECT
  c.id,
  1 as version,
  c.thumbnail_light_url,
  c.thumbnail_dark_url,
  TRUE as is_current,
  c.created_at as regenerated_at,
  'Initial migration - v1' as notes
FROM public.circuits c
WHERE c.thumbnail_light_url IS NOT NULL
  AND c.thumbnail_dark_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.thumbnail_history th
    WHERE th.circuit_id = c.id AND th.version = 1
  )
ON CONFLICT (circuit_id, version) DO NOTHING;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

-- Your CircuitSnips database is now fully configured! 🎉
--
-- Next steps:
--   1. Configure GitHub OAuth in Supabase Dashboard > Authentication > Providers
--   2. Set allowed redirect URLs in Authentication > URL Configuration
--   3. Copy your Supabase URL and anon key to .env.local
--   4. Run the frontend: npm run dev
--
-- This script is idempotent and safe to run multiple times.
-- All statements use IF NOT EXISTS or CREATE OR REPLACE to avoid errors.
