-- CircuitSnips Database Schema
-- Run this in Supabase SQL Editor after creating your project

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Extends auth.users with public profile information
-- ============================================================================
CREATE TABLE public.profiles (
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
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text from 1 for 8)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- CIRCUITS TABLE
-- Main table for storing circuit metadata
-- ============================================================================
CREATE TABLE public.circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Storage paths
  file_path TEXT NOT NULL, -- Path in Supabase Storage
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

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Indexes for performance
CREATE INDEX circuits_user_id_idx ON public.circuits(user_id);
CREATE INDEX circuits_created_at_idx ON public.circuits(created_at DESC);
CREATE INDEX circuits_tags_idx ON public.circuits USING GIN(tags);
CREATE INDEX circuits_category_idx ON public.circuits(category);

-- Full-text search column and index
ALTER TABLE public.circuits ADD COLUMN search_vector tsvector;

CREATE INDEX circuits_search_idx ON public.circuits USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_circuit_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector on insert/update
CREATE TRIGGER update_circuit_search_trigger
  BEFORE INSERT OR UPDATE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION update_circuit_search_vector();

-- ============================================================================
-- CIRCUIT COMPONENTS
-- Detailed component information extracted from schematic
-- ============================================================================
CREATE TABLE public.circuit_components (
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

CREATE INDEX circuit_components_circuit_id_idx ON public.circuit_components(circuit_id);
CREATE INDEX circuit_components_lib_id_idx ON public.circuit_components(lib_id);

-- ============================================================================
-- FAVORITES
-- Track which users favorited which circuits
-- ============================================================================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, circuit_id)
);

CREATE INDEX favorites_user_id_idx ON public.favorites(user_id);
CREATE INDEX favorites_circuit_id_idx ON public.favorites(circuit_id);

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

CREATE TRIGGER update_favorite_count_trigger
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION update_circuit_favorite_count();

-- ============================================================================
-- COPY TRACKING
-- Track when users copy circuits to their clipboard
-- ============================================================================
CREATE TABLE public.circuit_copies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Allow anonymous copies
  copied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX circuit_copies_circuit_id_idx ON public.circuit_copies(circuit_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_copies ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, users can update own profile
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Circuits: Public read, authenticated users can insert, owners can update/delete
CREATE POLICY "Circuits are viewable by everyone"
  ON public.circuits FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create circuits"
  ON public.circuits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own circuits"
  ON public.circuits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own circuits"
  ON public.circuits FOR DELETE
  USING (auth.uid() = user_id);

-- Circuit Components: Same as circuits
CREATE POLICY "Components are viewable by everyone"
  ON public.circuit_components FOR SELECT
  USING (true);

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
CREATE POLICY "Users can view all favorites"
  ON public.favorites FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = user_id);

-- Circuit Copies: Anyone can insert, users can view own
CREATE POLICY "Anyone can record a copy"
  ON public.circuit_copies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own copies"
  ON public.circuit_copies FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create circuits bucket (run this in SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('circuits', 'circuits', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage
CREATE POLICY "Anyone can view circuit files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'circuits');

CREATE POLICY "Authenticated users can upload circuit files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'circuits' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own circuit files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'circuits' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own circuit files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'circuits' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment view count (call this when viewing a circuit)
CREATE OR REPLACE FUNCTION increment_circuit_views(circuit_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.circuits
  SET view_count = view_count + 1
  WHERE id = circuit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search circuits
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
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- This will be populated by your application
-- The knock sensor example will be the first circuit in the system
