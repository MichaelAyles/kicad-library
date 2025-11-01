-- Add offset parameter to search_circuits_weighted function for pagination

DROP FUNCTION IF EXISTS search_circuits_weighted(TEXT, TEXT, TEXT, TEXT, UUID, INT);

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
