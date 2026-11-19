-- ============================================================================
-- Identity for WorkOS AuthKit (Nov 2026)
-- ============================================================================
-- Idempotent. Run in the Supabase SQL editor as one script. Safe to re-run.
-- Runs in a single transaction: if any check fails, nothing is changed.
--
-- Prepares the database for WorkOS AuthKit tokens (Supabase third-party auth)
-- while Supabase Auth tokens keep working, so it can be applied BEFORE the
-- app switches auth. See docs/workos-migration.md for the full runbook.
--
-- WorkOS access tokens carry this JWT template (configured in WorkOS):
--   { "role": "authenticated",
--     "uid": <Supabase/profile uuid, from WorkOS user.external_id>,
--     "app_role": <"admin" or absent, from WorkOS user metadata> }
-- Their `sub` is a WorkOS id (user_01...), not a uuid, so auth.uid() (which
-- casts `sub` to uuid) raises an error for them. This migration:
--
--   1. Preflight: aborts with a clear message if the database has an identity
--      dependency this script doesn't know how to convert, or a user-owned
--      row pointing at a user id that has no profile.
--   2. Adds public.current_user_id() and public.is_admin(), which read either
--      token type and never raise on malformed claims.
--   3. Makes public.profiles(id) the root identity: drops its foreign key to
--      auth.users and repoints every other foreign key to auth.users at
--      profiles(id), keeping each one's ON DELETE action. An AFTER DELETE
--      trigger on auth.users keeps today's behaviour that deleting a Supabase
--      Auth user deletes their profile and everything that cascades from it.
--   4. Rewrites handle_new_user around a new public.ensure_profile() with a
--      collision-safe username fallback. ensure_profile is also what the API
--      (service role) calls to create profiles for WorkOS users, who never
--      appear in auth.users.
--   5. Replaces auth.uid() / auth.jwt() in every RLS policy with the helpers.
--      Policy semantics are otherwise unchanged. The helpers are wrapped in
--      (SELECT ...) so they are evaluated once per statement, not per row.
--   6. Folds in migrations/20261113_circuit_write_guards.sql verbatim (a no-op
--      if that file was already run), so this script doesn't depend on
--      whether it was.
--   7. Grants and revokes, then asserts nothing in public still depends on
--      auth.uid(), auth.jwt() or auth.users.
--
-- Not changed: auth.role() checks (they read the `role` claim, which both
-- token types set), guard_circuit_writes' current_user check (third-party
-- tokens also map to the `authenticated` Postgres role), counters, search.
--
-- The verification queries at the bottom are commented out; run them after
-- applying.
-- ============================================================================

BEGIN;

-- Don't queue behind long-running queries while holding table locks
SET LOCAL lock_timeout = '10s';
-- Keep `auth` off the search_path so policy expressions read back from the
-- catalog spell auth.uid() schema-qualified (the generic rewrite in step 5
-- matches on that spelling).
SET LOCAL search_path = public, extensions, pg_temp;


-- ----------------------------------------------------------------------------
-- 1. Preflight
-- ----------------------------------------------------------------------------

DO $preflight$
DECLARE
  fk RECORD;
  obj RECORD;
  n BIGINT;
  problems TEXT := '';
BEGIN
  -- 1a. Every foreign key from public to auth.users must be a single-column
  --     reference to auth.users(id) (anything else needs a manual decision).
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND r.relnamespace = 'public'::regnamespace
      AND (cardinality(c.conkey) <> 1
           OR c.confkey <> ARRAY[(SELECT attnum FROM pg_attribute
                                  WHERE attrelid = 'auth.users'::regclass
                                    AND attname = 'id')])
  LOOP
    problems := problems || format(E'\n  - foreign key %s on %s is not a single-column reference to auth.users(id)',
                                   fk.conname, fk.tbl);
  END LOOP;

  -- 1b. Orphans: rows in columns that will reference profiles(id) after this
  --     migration, but whose user id has no profile. Fix these first (see
  --     the remediation note below), then re-run.
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND r.relnamespace = 'public'::regnamespace
      AND c.conrelid <> 'public.profiles'::regclass
      AND cardinality(c.conkey) = 1
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t
       WHERE t.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.%I)',
      fk.tbl, fk.col, fk.col)
    INTO n;
    IF n > 0 THEN
      problems := problems || format(E'\n  - %s row(s) in %s.%s reference a user id with no profile',
                                     n, fk.tbl, fk.col);
    END IF;
  END LOOP;

  -- 1c. Functions in public that read Supabase Auth identity directly. Their
  --     bodies can't be rewritten mechanically; convert them by hand.
  --     (handle_new_user and the functions created below don't match.)
  FOR obj IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind IN ('f', 'p')
      AND p.prosrc ~* 'auth\.(uid|jwt|email)\s*\(|auth\.users'
  LOOP
    problems := problems || format(E'\n  - function %s reads auth.uid()/auth.jwt()/auth.email()/auth.users',
                                   obj.sig);
  END LOOP;

  -- 1d. Views in public that read Supabase Auth identity or auth tables.
  FOR obj IN
    SELECT c.oid::regclass AS v
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('v', 'm')
      AND pg_get_viewdef(c.oid) ~* 'auth\.(uid|jwt|email)\s*\(|auth\.users'
  LOOP
    problems := problems || format(E'\n  - view %s reads auth.uid()/auth.jwt()/auth.email()/auth.users',
                                   obj.v);
  END LOOP;

  -- 1e. Policies that read identity in a way this script doesn't convert:
  --     auth.users subqueries, user_metadata, auth.email() or auth.jwt(), in
  --     any policy other than the ones step 5 drops and recreates by name.
  --     (auth.uid() anywhere is converted in step 5.)
  FOR obj IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND COALESCE(p.qual, '') || ' ' || COALESCE(p.with_check, '')
          ~* 'auth\.users|user_metadata|auth\.(email|jwt)\s*\('
      AND (p.tablename, p.policyname) NOT IN (VALUES
        ('profiles', 'Users can update own profile'),
        ('circuits', 'Public circuits and own circuits are viewable'),
        ('circuits', 'Authenticated users can create circuits'),
        ('circuits', 'Users can update own circuits'),
        ('circuits', 'Users can delete own circuits'),
        ('circuit_components', 'Circuit owners can manage components'),
        ('favorites', 'Users can manage own favorites'),
        ('circuit_copies', 'Users can view own copies'),
        ('circuit_comments', 'Authenticated users can create comments'),
        ('circuit_comments', 'Users can update own comments'),
        ('circuit_comments', 'Users can delete own comments'),
        ('comment_likes', 'Users can manage own comment likes'),
        ('thumbnail_history', 'Circuit owner or admin can insert history'),
        ('thumbnail_history', 'Only admins can update history'),
        ('thumbnail_history', 'Only admins can delete history'),
        ('circuit_flags', 'Anyone can flag circuits'),
        ('circuit_flags', 'Users can view own flags'),
        ('circuit_flags', 'Admins can view all flags'),
        ('circuit_flags', 'Admins can update flags'),
        ('circuit_flags', 'Admins can delete flags'))
  LOOP
    problems := problems || format(E'\n  - policy "%s" on %s.%s reads auth.users, user_metadata, auth.email() or auth.jwt()',
                                   obj.policyname, obj.schemaname, obj.tablename);
  END LOOP;

  IF problems <> '' THEN
    RAISE EXCEPTION 'identity_for_workos preflight failed; nothing was changed:%', problems
      USING HINT = 'Resolve each item, then re-run. For orphaned optional '
                   'references (flagged_by, regenerated_by, imported_by, '
                   'bot_user_id) setting the column to NULL matches what '
                   'deleting that user would have done.';
  END IF;

  -- Informational: Supabase Auth users without a profile. Not an error (no
  -- user-owned rows can point at them), but the WorkOS export includes them,
  -- and their profile will be created by the API on first WorkOS sign-in.
  SELECT count(*) INTO n
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
  IF n > 0 THEN
    RAISE NOTICE 'identity_for_workos: % auth user(s) have no profile row', n;
  END IF;
END
$preflight$;


-- ----------------------------------------------------------------------------
-- 2. Identity helpers
-- ----------------------------------------------------------------------------
-- Both read the caller's own verified JWT claims (set by PostgREST, Storage
-- and Realtime from a token Supabase has already verified). They are
-- SECURITY INVOKER, have no side effects, and return NULL / false instead of
-- raising when claims are missing or malformed.

-- The caller's profile id:
--   WorkOS token:        the `uid` claim (must be a uuid, else NULL)
--   Supabase Auth token: `sub` (a uuid), as auth.uid() returned
--   anon / service key:  NULL (no uid, no sub), as auth.uid() returned
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  uuid_re CONSTANT TEXT :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  claims JSONB;
  candidate TEXT;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF claims IS NOT NULL AND jsonb_typeof(claims) = 'object' THEN
    IF claims ? 'uid' AND jsonb_typeof(claims -> 'uid') <> 'null' THEN
      -- A token that carries `uid` is identified by it alone
      candidate := claims ->> 'uid';
    ELSE
      candidate := claims ->> 'sub';
    END IF;
  ELSIF claims IS NULL THEN
    -- Older PostgREST / Storage versions set one setting per claim
    candidate := COALESCE(
      NULLIF(current_setting('request.jwt.claim.uid', true), ''),
      NULLIF(current_setting('request.jwt.claim.sub', true), ''));
  END IF;

  IF candidate IS NOT NULL AND candidate ~ uuid_re THEN
    RETURN candidate::UUID;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_user_id() IS
  'Profile id of the caller: uid claim (WorkOS) or uuid sub (Supabase Auth); NULL otherwise. Use instead of auth.uid().';

-- Whether the caller is a site admin:
--   WorkOS token:        `app_role` claim = 'admin' (from WorkOS user
--                        metadata, which only the server can write)
--   Supabase Auth token: app_metadata.role = 'admin' (service-role only)
-- Never reads user_metadata, which users can edit.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claims JSONB;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF claims IS NULL OR jsonb_typeof(claims) <> 'object' THEN
    RETURN false;
  END IF;

  RETURN COALESCE(claims ->> 'app_role' = 'admin', false)
      OR COALESCE(claims -> 'app_metadata' ->> 'role' = 'admin', false);
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when the caller''s token marks them admin (app_role claim or app_metadata.role). Never reads user_metadata.';

-- Every role that evaluates RLS policies needs EXECUTE. Supabase's default
-- privileges already grant it to anon/authenticated/service_role; this makes
-- the intent explicit and removes the PUBLIC default.
REVOKE ALL ON FUNCTION public.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. Profiles become the root identity
-- ----------------------------------------------------------------------------
-- profiles.id keeps the same uuids. Its foreign key to auth.users goes (WorkOS
-- users have no auth.users row). Every other foreign key to auth.users in
-- public is recreated against profiles(id) under the same name and with the
-- same ON DELETE action, so deleting a profile has the effect that deleting
-- the auth user had. User-owned tables (circuits, favorites, comments,
-- comment likes) already reference profiles with ON DELETE CASCADE; optional
-- attribution columns (circuit_flags.flagged_by, thumbnail_history.
-- regenerated_by, import_batches.imported_by / bot_user_id) keep
-- ON DELETE SET NULL, so a deleted user's flags stay as anonymous flags.

DO $fks$
DECLARE
  fk RECORD;
  on_delete TEXT;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid, c.conrelid::regclass AS tbl, c.confdeltype,
           a.attname AS col
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND r.relnamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);

    IF fk.conrelid = 'public.profiles'::regclass THEN
      RAISE NOTICE 'identity_for_workos: dropped %.% (profiles is now the root identity)',
        fk.tbl, fk.conname;
      CONTINUE;
    END IF;

    on_delete := CASE fk.confdeltype
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
      WHEN 'r' THEN 'RESTRICT'
      ELSE 'NO ACTION'
    END;
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
      fk.tbl, fk.conname, fk.col, on_delete);
    RAISE NOTICE 'identity_for_workos: %.% now references public.profiles(id) ON DELETE %',
      fk.tbl, fk.conname, on_delete;
  END LOOP;
END
$fks$;

-- Deleting a profile now has to find these rows without a full scan
CREATE INDEX IF NOT EXISTS circuit_flags_flagged_by_idx
  ON public.circuit_flags(flagged_by) WHERE flagged_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS thumbnail_history_regenerated_by_idx
  ON public.thumbnail_history(regenerated_by);


-- ----------------------------------------------------------------------------
-- 4. Profile creation and deletion
-- ----------------------------------------------------------------------------

-- Create the profile for a user id, or return the existing one unchanged.
-- Supabase-era: called by handle_new_user. WorkOS-era: called by the API with
-- the service role (e.g. an /api/me upsert on first sign-in), because WorkOS
-- users never reach auth.users and so never fire handle_new_user.
--
-- Username: p_username with characters outside [A-Za-z0-9_-] removed and cut
-- to 30, or user_<first 8 hex of id> when fewer than 3 characters remain.
-- If taken: <base>_1 .. <base>_9, then <base>_<8 random hex>, each trimmed so
-- the result stays within 30 characters. Concurrent sign-ups that pick the
-- same name are retried, not failed.
CREATE OR REPLACE FUNCTION public.ensure_profile(
  p_id UUID,
  p_username TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_github_url TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_len CONSTANT INTEGER := 30;  -- profiles.username_length
  v_profile public.profiles;
  v_base TEXT;
  v_suffix TEXT;
  v_candidate TEXT;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'ensure_profile: id is required'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_id;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  v_base := left(regexp_replace(COALESCE(p_username, ''), '[^a-zA-Z0-9_-]', '', 'g'), max_len);
  IF char_length(v_base) < 3 THEN
    v_base := 'user_' || left(replace(p_id::TEXT, '-', ''), 8);
  END IF;

  FOR attempt IN 0..29 LOOP
    v_suffix := CASE
      WHEN attempt = 0 THEN ''
      WHEN attempt <= 9 THEN '_' || attempt
      ELSE '_' || left(replace(gen_random_uuid()::TEXT, '-', ''), 8)
    END;
    v_candidate := left(v_base, max_len - char_length(v_suffix)) || v_suffix;

    CONTINUE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE username = v_candidate);

    BEGIN
      INSERT INTO public.profiles (id, username, avatar_url, github_url)
      VALUES (p_id, v_candidate, p_avatar_url, p_github_url)
      ON CONFLICT (id) DO NOTHING
      RETURNING * INTO v_profile;

      IF NOT FOUND THEN
        -- Created concurrently for the same id
        SELECT * INTO v_profile FROM public.profiles WHERE id = p_id;
      END IF;
      RETURN v_profile;
    EXCEPTION WHEN unique_violation THEN
      -- Username taken concurrently; try the next candidate
      NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'ensure_profile: no free username for %', p_id
    USING ERRCODE = 'unique_violation';
END;
$$;

COMMENT ON FUNCTION public.ensure_profile(UUID, TEXT, TEXT, TEXT) IS
  'Create the profile for a user id (collision-safe username) or return the existing one. Service role only.';

-- Supabase Auth sign-ups (kept for the transition). WorkOS-era profiles are
-- created by the API via ensure_profile, not by this trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  github_login TEXT := NULLIF(btrim(meta ->> 'user_name'), '');
BEGIN
  -- Only link a GitHub profile for a well-formed GitHub login
  IF github_login IS NOT NULL
     AND github_login !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' THEN
    github_login := NULL;
  END IF;

  PERFORM public.ensure_profile(
    NEW.id,
    -- GitHub OAuth provides user_name / preferred_username / login
    COALESCE(
      NULLIF(btrim(meta ->> 'user_name'), ''),
      NULLIF(btrim(meta ->> 'preferred_username'), ''),
      NULLIF(btrim(meta ->> 'login'), '')),
    meta ->> 'avatar_url',
    CASE WHEN github_login IS NOT NULL THEN 'https://github.com/' || github_login END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Deleting a Supabase Auth user still deletes their profile (and, through the
-- cascades, everything they own), as the dropped profiles -> auth.users
-- foreign key did. Account deletion keeps working unchanged until the app
-- deletes profiles directly. Drop this trigger before bulk-removing
-- auth.users rows after the WorkOS cutover (see docs/workos-migration.md).
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();


-- ----------------------------------------------------------------------------
-- 5. RLS policies
-- ----------------------------------------------------------------------------
-- Same names, commands, roles and conditions as before; only the identity
-- source changes:
--   auth.uid()                                  -> (SELECT public.current_user_id())
--   (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' -> (SELECT public.is_admin())

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT public.current_user_id()) = id);

-- circuits
DROP POLICY IF EXISTS "Public circuits and own circuits are viewable" ON public.circuits;
CREATE POLICY "Public circuits and own circuits are viewable"
  ON public.circuits FOR SELECT
  USING (is_public = true OR (SELECT public.current_user_id()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can create circuits" ON public.circuits;
CREATE POLICY "Authenticated users can create circuits"
  ON public.circuits FOR INSERT
  WITH CHECK ((SELECT public.current_user_id()) = user_id);

DROP POLICY IF EXISTS "Users can update own circuits" ON public.circuits;
CREATE POLICY "Users can update own circuits"
  ON public.circuits FOR UPDATE
  USING ((SELECT public.current_user_id()) = user_id);

DROP POLICY IF EXISTS "Users can delete own circuits" ON public.circuits;
CREATE POLICY "Users can delete own circuits"
  ON public.circuits FOR DELETE
  USING ((SELECT public.current_user_id()) = user_id);

-- circuit_components
DROP POLICY IF EXISTS "Circuit owners can manage components" ON public.circuit_components;
CREATE POLICY "Circuit owners can manage components"
  ON public.circuit_components FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.circuits
      WHERE circuits.id = circuit_components.circuit_id
      AND circuits.user_id = (SELECT public.current_user_id())
    )
  );

-- favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING ((SELECT public.current_user_id()) = user_id);

-- circuit_copies
DROP POLICY IF EXISTS "Users can view own copies" ON public.circuit_copies;
CREATE POLICY "Users can view own copies"
  ON public.circuit_copies FOR SELECT
  USING ((SELECT public.current_user_id()) = user_id OR user_id IS NULL);

-- circuit_comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.circuit_comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.circuit_comments FOR INSERT
  WITH CHECK ((SELECT public.current_user_id()) = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.circuit_comments;
CREATE POLICY "Users can update own comments"
  ON public.circuit_comments FOR UPDATE
  USING ((SELECT public.current_user_id()) = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.circuit_comments;
CREATE POLICY "Users can delete own comments"
  ON public.circuit_comments FOR DELETE
  USING ((SELECT public.current_user_id()) = user_id);

-- comment_likes
DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users can manage own comment likes"
  ON public.comment_likes FOR ALL
  USING ((SELECT public.current_user_id()) = user_id);

-- thumbnail_history
DROP POLICY IF EXISTS "Circuit owner or admin can insert history" ON public.thumbnail_history;
CREATE POLICY "Circuit owner or admin can insert history"
  ON public.thumbnail_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circuits
      WHERE circuits.id = thumbnail_history.circuit_id
      AND circuits.user_id = (SELECT public.current_user_id())
    )
  );

DROP POLICY IF EXISTS "Only admins can update history" ON public.thumbnail_history;
CREATE POLICY "Only admins can update history"
  ON public.thumbnail_history FOR UPDATE
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Only admins can delete history" ON public.thumbnail_history;
CREATE POLICY "Only admins can delete history"
  ON public.thumbnail_history FOR DELETE
  USING ((SELECT public.is_admin()));

-- circuit_flags
DROP POLICY IF EXISTS "Anyone can flag circuits" ON public.circuit_flags;
CREATE POLICY "Anyone can flag circuits"
  ON public.circuit_flags FOR INSERT
  WITH CHECK (flagged_by IS NULL OR flagged_by = (SELECT public.current_user_id()));

DROP POLICY IF EXISTS "Users can view own flags" ON public.circuit_flags;
CREATE POLICY "Users can view own flags"
  ON public.circuit_flags FOR SELECT
  USING ((SELECT public.current_user_id()) = flagged_by);

DROP POLICY IF EXISTS "Admins can view all flags" ON public.circuit_flags;
CREATE POLICY "Admins can view all flags"
  ON public.circuit_flags FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can update flags" ON public.circuit_flags;
CREATE POLICY "Admins can update flags"
  ON public.circuit_flags FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can delete flags" ON public.circuit_flags;
CREATE POLICY "Admins can delete flags"
  ON public.circuit_flags FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- Anything else in public or storage that still calls auth.uid() (policies
-- added outside the repo, and the legacy Supabase Storage policies, which the
-- app no longer uses): substitute the helper in place, keeping the rest of
-- each expression. Column defaults in public get the same treatment.
DO $rewrite$
DECLARE
  pol RECORD;
  col RECORD;
  stmt TEXT;
  replacement CONSTANT TEXT := '(SELECT public.current_user_id())';
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%auth.uid()%'
  LOOP
    stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF pol.qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || replace(pol.qual, 'auth.uid()', replacement) || ')';
    END IF;
    IF pol.with_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || replace(pol.with_check, 'auth.uid()', replacement) || ')';
    END IF;

    BEGIN
      EXECUTE stmt;
      RAISE NOTICE 'identity_for_workos: rewrote policy "%" on %.%',
        pol.policyname, pol.schemaname, pol.tablename;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Only expected for storage.objects if this role can't alter it; the
      -- app doesn't use Supabase Storage. Public policies must not fail.
      IF pol.schemaname = 'public' THEN
        RAISE;
      END IF;
      RAISE WARNING 'identity_for_workos: could not rewrite storage policy "%" (insufficient privilege); it still uses auth.uid()',
        pol.policyname;
    END;
  END LOOP;

  FOR col IN
    SELECT c.oid::regclass AS tbl, a.attname, pg_get_expr(d.adbin, d.adrelid) AS def
    FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE c.relnamespace = 'public'::regnamespace
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%auth.uid()%'
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s',
                   col.tbl, col.attname, replace(col.def, 'auth.uid()', replacement));
    RAISE NOTICE 'identity_for_workos: rewrote default of %.%', col.tbl, col.attname;
  END LOOP;
END
$rewrite$;


-- ----------------------------------------------------------------------------
-- 6. Circuit write guards (verbatim from 20261113_circuit_write_guards.sql)
-- ----------------------------------------------------------------------------
-- Included so this script gives the same result whether or not that
-- migration was run. Keep the two (and setup.sql) in sync. See that file for
-- the rationale. current_user is still 'authenticated' for WorkOS tokens,
-- because Supabase maps their `role` claim to that Postgres role.

CREATE OR REPLACE FUNCTION public.guard_circuit_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
-- Must NOT be SECURITY DEFINER: the check relies on current_user being the
-- calling role.
SET search_path = public, pg_temp
AS $$
DECLARE
  -- R2_PUBLIC_URL, regex-escaped
  r2_origin CONSTANT TEXT := 'https://pub-5cfb1ad5b22e451db2e5711b584b49c9\.r2\.dev';
  -- Legacy Supabase Storage thumbnails bucket, regex-escaped
  legacy_thumbs CONSTANT TEXT := 'https://trjytrpqmfurirdaxlnr\.supabase\.co/storage/v1/object/public/thumbnails';
  circuit_key TEXT;
  old_schematic TEXT;
  old_light TEXT;
  old_dark TEXT;
  schematic_re TEXT;
  thumbnail_re TEXT;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.view_count := 0;
    NEW.copy_count := 0;
    NEW.favorite_count := 0;
    NEW.comment_count := 0;
    NEW.batch_import_id := NULL;
    NEW.github_owner := NULL;
    NEW.github_repo := NULL;
    NEW.created_at := now();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'circuits.id cannot be changed'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.view_count := OLD.view_count;
    NEW.copy_count := OLD.copy_count;
    NEW.favorite_count := OLD.favorite_count;
    NEW.comment_count := OLD.comment_count;
    NEW.batch_import_id := OLD.batch_import_id;
    NEW.github_owner := OLD.github_owner;
    NEW.github_repo := OLD.github_repo;
    NEW.created_at := OLD.created_at;

    old_schematic := OLD.schematic_r2_url;
    old_light := OLD.thumbnail_light_url;
    old_dark := OLD.thumbnail_dark_url;
  END IF;

  -- uuid text is [0-9a-f-] only, so it is safe to splice into a regex
  circuit_key := NEW.id::text;
  schematic_re := '^' || r2_origin || '/schematics/' || circuit_key
    || '\.kicad_sch(\?v=[0-9]+)?$';
  -- Path segments may not start with "." (no "." / ".." segments) and "%" is
  -- excluded (no encoded dot-segments), so a URL can't climb out of the
  -- circuit's own thumbnail prefix.
  -- Second alternative: legacy Supabase Storage layout
  -- thumbnails/<uploader uuid>/<id>-v<N>-<light|dark>.png, so "Set as Active"
  -- can restore an old thumbnail_history version. Pinned to the thumbnails
  -- bucket (no client upload policy) rather than any bucket, because the
  -- public circuits bucket accepts client uploads.
  thumbnail_re := '^(' || r2_origin || '/thumbnails/' || circuit_key
    || '((/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+|-v[0-9]+-[A-Za-z0-9_][A-Za-z0-9_.-]*)'
    || '(\?v=[0-9]+)?'
    || '|' || legacy_thumbs
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    || circuit_key || '-v[0-9]+-(light|dark)\.png)$';

  IF NEW.schematic_r2_url IS NOT NULL
     AND NEW.schematic_r2_url IS DISTINCT FROM old_schematic
     AND NEW.schematic_r2_url !~ schematic_re THEN
    RAISE EXCEPTION 'schematic_r2_url must point to this circuit''s schematic in CircuitSnips storage'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.thumbnail_light_url IS NOT NULL
     AND NEW.thumbnail_light_url IS DISTINCT FROM old_light
     AND NEW.thumbnail_light_url !~ thumbnail_re THEN
    RAISE EXCEPTION 'thumbnail_light_url must point to this circuit''s thumbnail in CircuitSnips storage'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.thumbnail_dark_url IS NOT NULL
     AND NEW.thumbnail_dark_url IS DISTINCT FROM old_dark
     AND NEW.thumbnail_dark_url !~ thumbnail_re THEN
    RAISE EXCEPTION 'thumbnail_dark_url must point to this circuit''s thumbnail in CircuitSnips storage'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Superseded by guard_circuit_writes
DROP TRIGGER IF EXISTS protect_circuit_counters_trigger ON public.circuits;
DROP FUNCTION IF EXISTS public.protect_circuit_counters();

DROP TRIGGER IF EXISTS guard_circuit_writes_trigger ON public.circuits;
CREATE TRIGGER guard_circuit_writes_trigger
  BEFORE INSERT OR UPDATE ON public.circuits
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_circuit_writes();


-- ----------------------------------------------------------------------------
-- 7. Function permissions and final checks
-- ----------------------------------------------------------------------------
-- Trigger functions don't need EXECUTE to fire. Supabase's default
-- privileges grant EXECUTE on new public functions to anon and authenticated,
-- so revoke from those roles explicitly, not just from PUBLIC.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_deleted_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_circuit_writes() FROM PUBLIC, anon, authenticated;

-- Creates rows for arbitrary ids: server (service role) only
REVOKE EXECUTE ON FUNCTION public.ensure_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(UUID, TEXT, TEXT, TEXT) TO service_role;

DO $postcheck$
DECLARE
  obj RECORD;
  problems TEXT := '';
BEGIN
  FOR obj IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND COALESCE(qual, '') || ' ' || COALESCE(with_check, '') ~* 'auth\.(uid|jwt|email)\s*\(|auth\.users|user_metadata'
  LOOP
    problems := problems || format(E'\n  - policy "%s" on public.%s', obj.policyname, obj.tablename);
  END LOOP;

  FOR obj IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosrc ~* 'auth\.(uid|jwt|email)\s*\(|auth\.users'
  LOOP
    problems := problems || format(E'\n  - function %s', obj.sig);
  END LOOP;

  FOR obj IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND r.relnamespace = 'public'::regnamespace
  LOOP
    problems := problems || format(E'\n  - foreign key %s on %s', obj.conname, obj.tbl);
  END LOOP;

  IF problems <> '' THEN
    RAISE EXCEPTION 'identity_for_workos: still depends on Supabase Auth identity; rolled back:%', problems;
  END IF;

  FOR obj IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%auth.uid()%'
  LOOP
    RAISE WARNING 'identity_for_workos: storage policy "%" still uses auth.uid() (unused by the app; WorkOS requests to Supabase Storage would fail it)',
      obj.policyname;
  END LOOP;
END
$postcheck$;

COMMIT;


-- ============================================================================
-- Verification (read-only; run each on its own, the SQL editor shows only
-- the last result)
-- ============================================================================
--
-- 1. Nothing in public or storage still calls auth.uid() or reads the admin
--    role from auth.jwt() (expect 0 rows from each):
--
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '') ~* 'auth\.(uid|jwt)\s*\('
--   AND schemaname IN ('public', 'storage');
--
-- SELECT p.oid::regprocedure
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.prosrc ~* 'auth\.(uid|jwt|email)\s*\(|auth\.users';
--
-- 2. Foreign keys: nothing in public references auth.users any more, and
--    every user reference points at profiles (expect: circuits, favorites,
--    circuit_comments, comment_likes = CASCADE; circuit_copies,
--    circuit_flags, thumbnail_history, import_batches x2 = SET NULL):
--
-- SELECT c.conrelid::regclass AS tbl, c.conname, c.confrelid::regclass AS refs,
--        CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
--             WHEN 'r' THEN 'RESTRICT' WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END AS on_delete
-- FROM pg_constraint c
-- WHERE c.contype = 'f'
--   AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
-- ORDER BY refs, tbl;
--
-- 3. Triggers on auth.users (expect on_auth_user_created and
--    on_auth_user_deleted) and the circuits write guard:
--
-- SELECT tgrelid::regclass, tgname, pg_get_triggerdef(oid)
-- FROM pg_trigger
-- WHERE tgrelid IN ('auth.users'::regclass, 'public.circuits'::regclass)
--   AND NOT tgisinternal
-- ORDER BY 1, 2;
--
-- 4. Permissions (expect: helpers t/t/t, ensure_profile f/f/t,
--    handle_* f/f):
--
-- SELECT f,
--        has_function_privilege('anon', f, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', f, 'EXECUTE') AS authenticated,
--        has_function_privilege('service_role', f, 'EXECUTE') AS service_role
-- FROM unnest(ARRAY[
--   'public.current_user_id()', 'public.is_admin()',
--   'public.ensure_profile(uuid,text,text,text)',
--   'public.handle_new_user()', 'public.handle_deleted_user()']) AS f;
--
-- 5. Helper behaviour for each token type. Run the whole block; each SELECT
--    shows uid / admin for one simulated request, and nothing is kept.
--    Replace <your-uuid> with a real profile id to also see RLS in action
--    (the own-circuit count includes private circuits).
--
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- -- Supabase Auth token (admin)
-- SELECT set_config('request.jwt.claims',
--   '{"sub":"<your-uuid>","role":"authenticated","app_metadata":{"role":"admin"}}', true);
-- SELECT 'supabase' AS token, public.current_user_id() AS uid, public.is_admin() AS admin,
--        (SELECT count(*) FROM public.circuits WHERE user_id = public.current_user_id()) AS own_circuits;
-- -- WorkOS token (admin)
-- SELECT set_config('request.jwt.claims',
--   '{"sub":"user_01HXYZ","role":"authenticated","uid":"<your-uuid>","app_role":"admin"}', true);
-- SELECT 'workos' AS token, public.current_user_id() AS uid, public.is_admin() AS admin,
--        (SELECT count(*) FROM public.circuits WHERE user_id = public.current_user_id()) AS own_circuits;
-- -- WorkOS token without uid / app_role (new user, not yet linked): NULL, false
-- SELECT set_config('request.jwt.claims', '{"sub":"user_01HXYZ","role":"authenticated"}', true);
-- SELECT 'workos-unlinked' AS token, public.current_user_id() AS uid, public.is_admin() AS admin;
-- -- user_metadata is ignored: uid from sub, admin = false
-- SELECT set_config('request.jwt.claims',
--   '{"sub":"<your-uuid>","role":"authenticated","user_metadata":{"role":"admin"}}', true);
-- SELECT 'user_metadata' AS token, public.current_user_id() AS uid, public.is_admin() AS admin;
-- -- Malformed claims: NULL, false (no error)
-- SELECT set_config('request.jwt.claims', 'not json', true);
-- SELECT 'malformed' AS token, public.current_user_id() AS uid, public.is_admin() AS admin;
-- ROLLBACK;
--
-- BEGIN;
-- SET LOCAL ROLE anon;
-- -- Anonymous request (anon key): NULL, false
-- SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
-- SELECT 'anon' AS token, public.current_user_id() AS uid, public.is_admin() AS admin;
-- ROLLBACK;
