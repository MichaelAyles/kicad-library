-- CircuitSnips Comments System Migration
-- Run this in Supabase SQL Editor to add comments functionality

-- ============================================================================
-- CIRCUIT COMMENTS TABLE
-- Supports threaded replies via parent_comment_id
-- ============================================================================
CREATE TABLE public.circuit_comments (
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
CREATE INDEX circuit_comments_circuit_id_idx ON public.circuit_comments(circuit_id);
CREATE INDEX circuit_comments_user_id_idx ON public.circuit_comments(user_id);
CREATE INDEX circuit_comments_parent_id_idx ON public.circuit_comments(parent_comment_id);
CREATE INDEX circuit_comments_created_at_idx ON public.circuit_comments(created_at DESC);

-- ============================================================================
-- COMMENT LIKES TABLE
-- Track which users liked which comments
-- ============================================================================
CREATE TABLE public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.circuit_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(comment_id, user_id)
);

CREATE INDEX comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX comment_likes_user_id_idx ON public.comment_likes(user_id);

-- ============================================================================
-- TRIGGERS
-- Update likes_count when comment_likes change
-- ============================================================================
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

CREATE TRIGGER update_comment_likes_count_trigger
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_updated_at
  BEFORE UPDATE ON public.circuit_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.circuit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Comments: Everyone can read, authenticated users can create, owners can update/delete
CREATE POLICY "Comments are viewable by everyone"
  ON public.circuit_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.circuit_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.circuit_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.circuit_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Comment Likes: Users can manage their own likes
CREATE POLICY "Users can view all comment likes"
  ON public.comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own comment likes"
  ON public.comment_likes FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get comment count for a circuit
CREATE OR REPLACE FUNCTION get_circuit_comment_count(p_circuit_id UUID)
RETURNS INTEGER AS $$
DECLARE
  comment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO comment_count
  FROM public.circuit_comments
  WHERE circuit_id = p_circuit_id;

  RETURN comment_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment_count column to circuits table for caching
ALTER TABLE public.circuits ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

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

CREATE TRIGGER update_circuit_comment_count_trigger
  AFTER INSERT OR DELETE ON public.circuit_comments
  FOR EACH ROW EXECUTE FUNCTION update_circuit_comment_count();
