-- ============================================================================
-- Circuit write guards (Nov 2026)
-- ============================================================================
-- Idempotent. Run in the Supabase SQL editor. Safe to re-run.
--
-- Replaces the BEFORE UPDATE `protect_circuit_counters` trigger (from
-- security_hardening.sql) with one BEFORE INSERT OR UPDATE trigger that guards
-- every client write to public.circuits made through PostgREST
-- (current_user = anon / authenticated, outermost trigger level):
--
--   * Storage URLs: schematic_r2_url, thumbnail_light_url and
--     thumbnail_dark_url may only be set to this circuit's own objects in the
--     CircuitSnips R2 bucket. NULL is allowed, and so is leaving a value
--     unchanged. Anything else raises check_violation (HTTP 400).
--       schematic:  <R2>/schematics/<id>.kicad_sch[?v=<digits>]
--       thumbnails: <R2>/thumbnails/<id>/<file>[?v=<digits>]
--                   <R2>/thumbnails/<id>-v<N>-<file>[?v=<digits>]
--                   <legacy Supabase Storage>/thumbnails/<uuid>/<id>-v<N>-<light|dark>.png
--     The legacy form keeps the 4,296 rows that still hold Supabase Storage
--     thumbnails valid and lets the edit page restore an old
--     thumbnail_history version (every legacy URL in circuits and
--     thumbnail_history uses exactly this layout).
--   * Counters (view/copy/favorite/comment): forced to 0 on insert, kept at
--     their old values on update.
--   * Import provenance (batch_import_id, github_owner, github_repo): NULL on
--     insert, unchanged on update. Only the service-role batch import sets them.
--   * created_at: now() on insert, unchanged on update.
--   * id: can't be changed on update.
--
-- Not restricted: the service role (API routes using the admin client),
-- SECURITY DEFINER functions (current_user = function owner, e.g. the
-- increment_* RPCs and counter triggers) and writes made from inside other
-- triggers (pg_trigger_depth() > 1).
--
-- thumbnail_version stays client-writable: the owner's thumbnail flows (upload
-- wizard, edit page regenerate / version switch) set it directly, and it only
-- feeds a version label.
--
-- The R2 origin below is R2_PUBLIC_URL. If the bucket's public URL changes,
-- update it here and in supabase/setup.sql.
-- ============================================================================

BEGIN;

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

-- Trigger-only function: not callable via /rpc. Triggers don't need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.guard_circuit_writes() FROM PUBLIC, anon, authenticated;

-- Superseded by guard_circuit_writes
DROP TRIGGER IF EXISTS protect_circuit_counters_trigger ON public.circuits;
DROP FUNCTION IF EXISTS public.protect_circuit_counters();

DROP TRIGGER IF EXISTS guard_circuit_writes_trigger ON public.circuits;
CREATE TRIGGER guard_circuit_writes_trigger
  BEFORE INSERT OR UPDATE ON public.circuits
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_circuit_writes();

COMMIT;


-- ============================================================================
-- Verification (read-only; run each on its own, the SQL editor shows only
-- the last result)
-- ============================================================================
--
-- 1. Exactly one guard trigger, BEFORE INSERT OR UPDATE; no
--    protect_circuit_counters_trigger left:
--
-- SELECT tgname, pg_get_triggerdef(oid)
-- FROM pg_trigger
-- WHERE tgrelid = 'public.circuits'::regclass AND NOT tgisinternal
-- ORDER BY tgname;
--
-- 2. Function is SECURITY INVOKER with a pinned search_path, and the old one
--    is gone (expect one row: prosecdef = false,
--    proconfig = {"search_path=public, pg_temp"}):
--
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('guard_circuit_writes', 'protect_circuit_counters');
--
-- 3. Clients can't call it directly (expect false, false):
--
-- SELECT has_function_privilege('anon', 'public.guard_circuit_writes()', 'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated', 'public.guard_circuit_writes()', 'EXECUTE') AS auth_exec;
--
-- 4. Existing URLs by shape. 'other' should be 0 (a row listed there is left
--    alone, but a client couldn't change it to another value of that shape):
--
-- SELECT col,
--        CASE
--          WHEN url IS NULL THEN 'null'
--          WHEN col = 'schematic' AND url ~ ('^https://pub-5cfb1ad5b22e451db2e5711b584b49c9\.r2\.dev/schematics/' || id || '\.kicad_sch(\?v=[0-9]+)?$') THEN 'r2-ok'
--          WHEN col <> 'schematic' AND url ~ ('^https://pub-5cfb1ad5b22e451db2e5711b584b49c9\.r2\.dev/thumbnails/' || id || '((/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+|-v[0-9]+-[A-Za-z0-9_][A-Za-z0-9_.-]*)(\?v=[0-9]+)?$') THEN 'r2-ok'
--          WHEN col <> 'schematic' AND url ~ ('^https://trjytrpqmfurirdaxlnr\.supabase\.co/storage/v1/object/public/thumbnails/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' || id || '-v[0-9]+-(light|dark)\.png$') THEN 'legacy-ok'
--          ELSE 'other'
--        END AS shape,
--        count(*)
-- FROM (
--   SELECT id::text AS id, 'schematic' AS col, schematic_r2_url AS url FROM public.circuits
--   UNION ALL SELECT id::text, 'light', thumbnail_light_url FROM public.circuits
--   UNION ALL SELECT id::text, 'dark', thumbnail_dark_url FROM public.circuits
-- ) u
-- GROUP BY 1, 2
-- ORDER BY 1, 2;
--
-- 5. The legacy thumbnails bucket must not accept client writes, because the
--    guard accepts legacy thumbnails/... URLs (expect 0 rows; on 2026-11-13
--    the bucket no longer existed and storage only had 'circuits' policies):
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND cmd IN ('INSERT', 'UPDATE', 'ALL')
--   AND COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%thumbnails%';
--
-- 6. After the next real upload through the site, the new circuit should
--    have zero counters, no import provenance and R2 URLs:
--
-- SELECT slug, view_count, copy_count, favorite_count, comment_count,
--        batch_import_id, github_owner, schematic_r2_url, thumbnail_light_url
-- FROM public.circuits
-- WHERE batch_import_id IS NULL
-- ORDER BY created_at DESC
-- LIMIT 5;
