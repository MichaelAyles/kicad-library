-- Update search vector weights to prioritize tags > title > description
-- Tags should be most relevant (A), then title (B), then description (C)

-- Update the function to use new weights
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

-- Update existing records to use new weights
UPDATE public.circuits
SET search_vector =
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'A') ||
  setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C');
