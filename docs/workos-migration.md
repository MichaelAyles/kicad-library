# Moving auth to WorkOS AuthKit

CircuitSnips keeps Supabase for data. WorkOS AuthKit replaces Supabase Auth for
sign-in, and Supabase accepts WorkOS access tokens through
[third-party auth](https://supabase.com/docs/guides/auth/third-party/workos).
This runbook covers the database side and the user move.

## How identity works after the migration

- `public.profiles(id)` is the root identity. Ids don't change: a migrated
  user's profile id is their old `auth.users.id`, and WorkOS stores it as the
  user's `external_id`.
- RLS reads the caller through two helpers. Both accept either token type
  during the cutover, and neither raises on missing or malformed claims:
  - `public.current_user_id()` returns the `uid` claim (WorkOS), or `sub` when
    it is a uuid (Supabase Auth). Otherwise it returns NULL.
  - `public.is_admin()` checks for the `app_role` claim = `admin` (WorkOS) or
    `app_metadata.role` = `admin` (Supabase Auth). It never reads
    `user_metadata`.
- `auth.uid()` can't be used any more: it casts `sub` to uuid, and a WorkOS
  `sub` (`user_01...`) isn't a uuid.
- WorkOS users never get an `auth.users` row, so `handle_new_user` doesn't fire
  for them. The API creates their profile with the service role by calling
  `public.ensure_profile(p_id, p_username, p_avatar_url, p_github_url)`. It
  returns the existing profile if there is one and picks a free username
  otherwise.

## 1. Apply the migration (any time before the switch)

`supabase/migrations/20261116_identity_for_workos.sql` is safe to run while
the site still uses Supabase Auth, because both token types keep working. It
also includes `20261113_circuit_write_guards.sql`, so it doesn't matter
whether that one was run.

```bash
pbcopy < supabase/migrations/20261116_identity_for_workos.sql
```

Paste it into the Supabase SQL editor and run it as one script. It runs in a
single transaction:

- **Preflight.** It stops with a list, and changes nothing, if a row points at
  a user id that has no profile, or if a function, view or policy reads
  `auth.users`, `auth.jwt()` or `user_metadata` in a way the script can't
  convert. Fix each item, then re-run. For optional columns (`flagged_by`,
  `regenerated_by`, `imported_by`, `bot_user_id`), setting the value to NULL
  matches what deleting that user would have done.
- **Foreign keys.** It drops `profiles → auth.users` and repoints every other
  foreign key to `auth.users` at `profiles(id)`, keeping each one's
  `ON DELETE` action. Deleting a profile now removes everything the user owns.
  Their flags and history entries stay, with a NULL author.
- **Triggers.** A new `on_auth_user_deleted` trigger deletes the profile when
  a Supabase Auth user is deleted. Account deletion therefore works unchanged
  until the app deletes profiles itself.
- **Policies.** It rewrites every policy to use the helpers. Policy semantics
  are otherwise unchanged.

Then run the commented-out verification queries at the bottom of the file.
They check that no `auth.uid()` references remain, list the foreign keys,
show the permissions, and simulate a Supabase token, a WorkOS token and an
anonymous request.

## 2. Configure WorkOS

1. **JWT template** (WorkOS dashboard → Authentication → Sessions → JWT
   Template):

   ```json
   {
     "role": "authenticated",
     "uid": {{ user.external_id }},
     "app_role": {{ user.metadata.app_role }}
   }
   ```

   `role` must be `authenticated`: Supabase maps it to the Postgres role. The
   template leaves `uid` and `app_role` unquoted on purpose. When the value is
   null, WorkOS omits the key, whereas a quoted null renders as `""`. The
   helpers treat both the same, but omitting the key is cleaner.
2. Enable GitHub OAuth and email/password in AuthKit, and set the redirect
   URIs for `https://circuitsnips.com`.
3. **Admin.** Set user metadata `app_role` = `admin` on the admin's WorkOS
   user. The export below does this automatically for anyone who has
   `app_metadata.role = admin` today. Only the server (WorkOS dashboard or API
   key) may write this key, so no client-facing route may write arbitrary
   WorkOS metadata. The admin needs a fresh session before the claim appears.
   The API worker (`worker/auth.ts`) and the browser (`src/lib/auth`) read
   the same claim.

   The template can also be set with the CLI, but `workos api` uses the
   active profile's API key, so check that the profile belongs to the
   CircuitSnips environment first (`npx workos environment list`):

   ```bash
   npx workos api /user_management/jwt_template -X PUT --file jwt.json --yes
   ```
4. **Auth domain.** Without a custom domain, the app keeps the AuthKit
   refresh token in localStorage (devMode), because a cookie on
   `api.workos.com` is a third-party cookie that Safari and Firefox block.
   With a custom domain such as `auth.circuitsnips.com` (DNS on Cloudflare),
   set `NEXT_PUBLIC_WORKOS_API_HOSTNAME` and the token moves to an HttpOnly
   cookie. Use that host in the Supabase issuer below too.

## 3. Enable WorkOS in Supabase

Supabase dashboard → Authentication → Third-Party Auth → Add provider →
WorkOS. The issuer is:

```
https://api.workos.com/user_management/<WORKOS_CLIENT_ID>
```

If you use a custom WorkOS auth domain, use that host instead of
`api.workos.com`. Signing keys can take up to 30 minutes to be picked up.
Third-party MAUs are billed above the plan quota. Supabase Auth itself can't
be turned off, but its sign-ups and providers can be disabled after the
cutover.

## 4. Move the users

Turn off new Supabase sign-ups first (Authentication → Providers), so nobody
signs up between the export and the switch. Then run this query in the SQL
editor and download the result as `users.csv`:

```sql
SELECT
  u.email,
  CASE WHEN COALESCE(u.encrypted_password, '') <> '' THEN u.encrypted_password END AS password_hash,
  CASE WHEN COALESCE(u.encrypted_password, '') <> '' THEN 'bcrypt' END AS password_hash_type,
  CASE WHEN n.full_name IS NOT NULL THEN split_part(n.full_name, ' ', 1) END AS first_name,
  CASE WHEN position(' ' IN n.full_name) > 0
       THEN NULLIF(btrim(substr(n.full_name, position(' ' IN n.full_name) + 1)), '') END AS last_name,
  CASE WHEN u.email_confirmed_at IS NOT NULL THEN 'true' ELSE 'false' END AS email_verified,
  u.id::text AS external_id,
  CASE WHEN u.raw_app_meta_data ->> 'role' = 'admin' THEN '{"app_role":"admin"}' END AS metadata
FROM auth.users u
CROSS JOIN LATERAL (
  SELECT NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'full_name',
                               u.raw_user_meta_data ->> 'name')), '') AS full_name
) n
WHERE u.email IS NOT NULL
  AND u.deleted_at IS NULL
  AND NOT COALESCE(u.is_anonymous, false)
ORDER BY u.created_at;
```

The columns match the WorkOS CLI `users` template
(`npx workos migrations export-template users`):

- `email_verified` must be the text `true`/`false`. psql's `t`/`f` is rejected.
- `metadata` is a JSON object with string values.
- Supabase stores bcrypt hashes (`$2a$...`). GitHub-only users have no
  password, so their hash columns are empty and they keep signing in with
  GitHub.

The CLI needs Node 22 (`export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`)
and `WORKOS_API_KEY`:

```bash
npx workos migrations validate --csv users.csv
npx workos migrations import --csv users.csv --dry-run
npx workos migrations import --csv users.csv
# if errors.jsonl has rows:
npx workos migrations analyze --errors errors.jsonl --retry-csv retry.csv --original-csv users.csv
```

This was checked against `workos` CLI 0.24.0: `validate --strict` accepts
the query's output. Delete `users.csv` (and `retry.csv`) afterwards, because
they contain password hashes.

## 5. Switch the app

Build with `NEXT_PUBLIC_AUTH_PROVIDER=workos` and
`NEXT_PUBLIC_WORKOS_CLIENT_ID` (plus `NEXT_PUBLIC_WORKOS_API_HOSTNAME` with a
custom domain), and give the worker the secrets `WORKOS_CLIENT_ID`,
`WORKOS_API_KEY` and, with a custom domain, `WORKOS_ISSUER`. The database
needs nothing more.

- **First sign-in.** Imported users already have `external_id`, so their
  token carries `uid`. A brand-new WorkOS user has none: the browser calls
  `POST /api/me`, which creates the profile with `ensure_profile` (the id is
  derived from the WorkOS user id, so retries land on the same profile),
  writes it to the user's `external_id`, and the browser refreshes its token.
  Until then RLS treats them as signed out.
- **Account deletion.** The worker deletes the Supabase Auth user if there
  is one, then the `profiles` row (this cascades), the WorkOS user and the
  R2 files.

## 6. After the cutover

- Keep `auth.users` as it is. If you ever bulk-delete those rows, first run
  `DROP TRIGGER on_auth_user_deleted ON auth.users;`. Otherwise the trigger
  deletes every migrated user's profile and content.
- `handle_new_user` stays harmless once Supabase sign-ups are off.

## Rollback

- **App.** Redeploy the Supabase Auth version. The database accepts both token
  types, so the migration doesn't need to be undone. Users who signed up only
  in WorkOS have profiles but no Supabase login.
- **Database** (rarely needed). This works only while every profile still has
  an `auth.users` row. Run it in a transaction:

  ```sql
  BEGIN;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
  DROP FUNCTION IF EXISTS public.handle_deleted_user();
  COMMIT;
  ```

  The policies and helpers can stay, because they behave the same as before
  for Supabase tokens. To restore the old policy text exactly, re-run the
  policy sections of `supabase/setup.sql` from before this change. The
  repointed foreign keys can also stay: every profile id is an
  `auth.users.id`.
