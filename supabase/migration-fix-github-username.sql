-- Fix GitHub username extraction in handle_new_user function
-- GitHub OAuth provides user_name or preferred_username, not username
-- Run this in Supabase SQL Editor

-- Drop and recreate the function with proper GitHub metadata extraction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_username TEXT;
BEGIN
  -- Try to extract username from GitHub OAuth metadata
  -- GitHub provides: user_name, preferred_username, or login
  extracted_username := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.raw_user_meta_data->>'login',
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  -- Sanitize username to match our constraints (alphanumeric, dash, underscore)
  extracted_username := regexp_replace(extracted_username, '[^a-zA-Z0-9_-]', '', 'g');

  -- Ensure minimum length
  IF char_length(extracted_username) < 3 THEN
    extracted_username := 'user_' || substring(NEW.id::text from 1 for 8);
  END IF;

  -- Handle duplicate usernames by appending a number
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = extracted_username) LOOP
    extracted_username := extracted_username || floor(random() * 100)::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, avatar_url, github_url)
  VALUES (
    NEW.id,
    extracted_username,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN NEW.raw_user_meta_data->>'user_name' IS NOT NULL
      THEN 'https://github.com/' || (NEW.raw_user_meta_data->>'user_name')
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists, no need to recreate it
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
