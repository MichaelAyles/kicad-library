-- ============================================================================
-- Security hardening (Nov 2026)
-- ============================================================================
-- Idempotent. Run in the Supabase SQL editor AFTER deploying the matching app
-- code (admin checks now read app_metadata.role instead of user_metadata.role).
--
-- 1. Remove user-writable `role` from user_metadata and report any policies
--    that still trust user_metadata.
-- 2. thumbnail_history UPDATE/DELETE restricted to real admins.
-- 3. Counter columns on circuits can't be written directly by clients.
-- 4. sync_global_stats only callable by service role.
-- 5. Pin search_path on all SECURITY DEFINER functions in public.
-- 6. circuit_flags: can't file a flag as another user.
-- 7. previews storage: only the uploader can delete their preview.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Admin role lives in app_metadata (only writable by service role)
-- ----------------------------------------------------------------------------

-- STEP 0 — run this query ON ITS OWN first (the SQL editor only shows the
-- last result). Anyone listed who isn't a known admin may have exploited the
-- old user_metadata check; review their recent activity.
--
-- SELECT id, email, created_at, last_sign_in_at
-- FROM auth.users
-- WHERE raw_user_meta_data->>'role' = 'admin';

-- Strip the user-writable role key from everyone's user_metadata
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';

-- Grant admin explicitly (replace the email, then run):
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- WHERE email = '<admin-email>';
-- Admins must sign out and back in for their JWT to pick up the new claim.


-- ----------------------------------------------------------------------------
-- 2. thumbnail_history: only admins may update/delete
--    (previously any user with a profile row passed the check)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Only admins can update history" ON public.thumbnail_history;
CREATE POLICY "Only admins can update history"
  ON public.thumbnail_history
  FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Only admins can delete history" ON public.thumbnail_history;
CREATE POLICY "Only admins can delete history"
  ON public.thumbnail_history
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- ----------------------------------------------------------------------------
-- 3. Protect counter columns from direct client writes
--    SUPERSEDED by 20261113_circuit_write_guards.sql (guard_circuit_writes),
--    which drops this trigger. If you re-run this file, re-run that one after.
--    Owners could previously PATCH view_count/copy_count/etc on their own
--    circuits. Counter changes made by triggers (pg_trigger_depth() > 1),
--    SECURITY DEFINER functions (current_user = owner) and the service role
--    are still allowed.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_circuit_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND pg_trigger_depth() <= 1 THEN
    NEW.view_count := OLD.view_count;
    NEW.copy_count := OLD.copy_count;
    NEW.favorite_count := OLD.favorite_count;
    NEW.comment_count := OLD.comment_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_circuit_counters_trigger ON public.circuits;
CREATE TRIGGER protect_circuit_counters_trigger
  BEFORE UPDATE ON public.circuits
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_circuit_counters();


-- ----------------------------------------------------------------------------
-- 4. sync_global_stats: service role only (called from /api/admin/sync-stats)
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.sync_global_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_global_stats() TO service_role;


-- ----------------------------------------------------------------------------
-- 5. Pin search_path on every SECURITY DEFINER function in public
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 6. circuit_flags: flag anonymously or as yourself, not as someone else
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can flag circuits" ON public.circuit_flags;
CREATE POLICY "Anyone can flag circuits"
  ON public.circuit_flags FOR INSERT
  WITH CHECK (flagged_by IS NULL OR flagged_by = auth.uid());

-- Flags were publicly readable (reporter ids, details, admin notes).
-- Reporters can still see their own via "Users can view own flags".
DROP POLICY IF EXISTS "Anyone can view flags" ON public.circuit_flags;

DROP POLICY IF EXISTS "Admins can view all flags" ON public.circuit_flags;
CREATE POLICY "Admins can view all flags"
  ON public.circuit_flags FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- These previously trusted user_metadata (user-writable)
DROP POLICY IF EXISTS "Admins can update flags" ON public.circuit_flags;
CREATE POLICY "Admins can update flags"
  ON public.circuit_flags FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete flags" ON public.circuit_flags;
CREATE POLICY "Admins can delete flags"
  ON public.circuit_flags FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- ----------------------------------------------------------------------------
-- 7. previews bucket: only the uploader can delete
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can delete old previews" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own previews" ON storage.objects;
CREATE POLICY "Users can delete own previews"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'previews' AND owner = auth.uid());


-- ----------------------------------------------------------------------------
-- Counter triggers, RPC exposure, search_path, counter backfill
-- ----------------------------------------------------------------------------

-- 8. Counter triggers ran as the calling user, so RLS on circuits /
--    circuit_comments silently blocked updates to rows the user doesn't own
--    (favorite/comment/like counts never moved for others' content).
--    Run them as the owner instead; triggers don't need EXECUTE grants.
ALTER FUNCTION public.update_circuit_favorite_count() SECURITY DEFINER;
ALTER FUNCTION public.update_circuit_comment_count() SECURITY DEFINER;
ALTER FUNCTION public.update_comment_likes_count() SECURITY DEFINER;

-- 9. Trigger-only SECURITY DEFINER functions shouldn't be callable via /rpc
REVOKE EXECUTE ON FUNCTION public.update_circuit_favorite_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_circuit_comment_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_global_circuit_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_global_user_count() FROM PUBLIC, anon, authenticated;

-- 10. Pin search_path on every remaining function in public
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;

-- 11. Backfill counters that drifted because of (8)
UPDATE public.circuits ci
SET favorite_count = sub.n
FROM (
  SELECT ci2.id, COUNT(f.circuit_id) AS n
  FROM public.circuits ci2
  LEFT JOIN public.favorites f ON f.circuit_id = ci2.id
  GROUP BY ci2.id
) sub
WHERE sub.id = ci.id AND ci.favorite_count IS DISTINCT FROM sub.n;

UPDATE public.circuits ci
SET comment_count = sub.n
FROM (
  SELECT ci2.id, COUNT(c.circuit_id) AS n
  FROM public.circuits ci2
  LEFT JOIN public.circuit_comments c ON c.circuit_id = ci2.id
  GROUP BY ci2.id
) sub
WHERE sub.id = ci.id AND ci.comment_count IS DISTINCT FROM sub.n;

UPDATE public.circuit_comments cc
SET likes_count = sub.n
FROM (
  SELECT cc2.id, COUNT(l.comment_id) AS n
  FROM public.circuit_comments cc2
  LEFT JOIN public.comment_likes l ON l.comment_id = cc2.id
  GROUP BY cc2.id
) sub
WHERE sub.id = cc.id AND cc.likes_count IS DISTINCT FROM sub.n;


-- ----------------------------------------------------------------------------
-- Audit: any remaining policies that trust user_metadata (should be empty).
-- Policies from old migrations (e.g. circuit_flags admin policies) may still
-- exist in the live DB; rewrite any listed here to use app_metadata.
-- ----------------------------------------------------------------------------

SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE COALESCE(qual, '') || COALESCE(with_check, '') ~* 'user_meta';
