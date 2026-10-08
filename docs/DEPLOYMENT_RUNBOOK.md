# Deployment runbook: August schema → canonical (PROPOSAL, not approved)

This document is a proposal. Nothing in it has been executed against production.
Every step that writes to a hosted project requires a separate, explicit owner
approval.

## 0. Scope and evidence

| Item | Value |
|---|---|
| File | `supabase/migrations/20260929144644_reconcile_august_schema_to_canonical.sql` |
| Size / MD5 | 84,090 bytes, LF, `4d2785e0e93e31c45c91d8b0bbc395dc` |
| Source migration version | `20260929144644` (from the filename) |
| Clone-only recorded version | `20261006065826`. It was stamped when the file was applied to the restored clone `xodkbvzfrehchfeaonok` on 2026-10-06. It is **not** this file's version and must never be recorded on any other project. |
| Production | `elrektmnhanvgdgtlsfe`, unchanged |

The SQL file must be applied byte-for-byte as reviewed. Do not edit it.

There are three kinds of evidence. Keep them apart.

| Evidence | Source | Status |
|---|---|---|
| Legacy conversion on the restored clone: Auth and profile digests preserved, canonical postconditions passed | Orchestrator report, 2026-10-06 | **Reported, not re-run from this repo.** Repeating unchanged SQL on a new paid project is not required by this runbook. |
| Local disposable runs (canonical preservation, legacy conversion, access checks, rejection of write rules/triggers on `listing_sellers`) | Earlier report | **Reported, not re-run from this repo.** |
| Static review of the SQL; file MD5/size; app `npm ci`, `lint`, `typecheck`, `test` (Vitest), `build` | CI runs on PR #3 / this branch | **Executed** |

Still unverified:
- a legacy run that can be reproduced from this repo. The source August schema
  backup and catalogue export are not tracked, and no fixture has been invented
  to stand in for them;
- the canonical no-op path under `supabase db reset` on a local stack;
- application end-to-end behaviour (Playwright seller lifecycle);
- behaviour under live traffic.

## 1. What happens to data

| | Preserved? |
|---|---|
| `auth.users` rows | Yes. Not written; digest compared before and after. |
| `public.profiles` rows | Yes. Every `id` kept. |
| `phone`, `city`, `avatar_url`, `created_at`, `updated_at` | Yes, copied and re-checked. |
| `full_name`, `username` | Merged: `display_name = coalesce(nullif(btrim(full_name),''), nullif(btrim(username),''))`. `username` is **lost** whenever `full_name` is non-blank. Both source columns are dropped. |
| `is_dealer` | **Lost.** |
| Any other legacy `profiles` column | **Lost silently.** The column check only requires the expected columns to be present. It does not reject extras. |
| `preferred_language` | Set to `'lt'` for everyone. |
| `phone_is_public` | Set to **`true`** for everyone. See below. |

**Row preservation is not field preservation.** The temporary snapshot is
`on commit drop`. After the migration, the dropped fields exist only in the
backup taken in §4.

**Consequences of `phone_is_public = true`.** The public `listing_sellers` view
shows `phone` whenever `phone_is_public` is true. As soon as a migrated seller
has an active, approved listing, the phone number they gave under the August
schema becomes public. Options:
- (a) accept it and notify users;
- (b) prepare a separate, reviewed follow-up that sets it to `false` before any
  listing can be approved;
- (c) do not deploy until a consent flow exists.

## 2. Owner decision (required before production)

Record the following in writing, signed off by the owner:
- the actual legacy `profiles` columns found in §3, and acceptance that every
  column other than the mapped ones is dropped;
- acceptance of the `username` loss rule and the `is_dealer` loss;
- the `phone_is_public` choice from §1;
- the `preferred_language = 'lt'` reset;
- the backup method (§4), the verified restore test (§5), the maintenance
  window, and the rollback owner.

No decision means no deploy.

## 3. Read-only pre-flight on the target

```sql
show server_version;   -- must be 17.x, matching supabase/config.toml major_version = 17

-- the applying role needs BYPASSRLS (or superuser): profiles has FORCE RLS
-- and the migration inserts into it
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' order by ordinal_position;

select count(*) from public.profiles;
select count(*) from auth.users;

select count(*) from public.listings;          -- must be 0
select count(*) from public.listing_images;    -- must be 0
select count(*) from storage.objects where bucket_id = 'listing-images';  -- must be 0

select version, name from supabase_migrations.schema_migrations order by version;
```

Also verify the file: `md5sum` and `wc -c` must match §0.

Keep the outputs with the decision record. Any mismatch means stop.

## 4. Backup

1. **Check platform backups; do not assume they exist.** These are two different
   things:
   - *Daily physical backups*: whole-database snapshots taken once a day by the
     platform on some plans. Restoring one discards everything since the
     snapshot.
   - *PITR (point-in-time recovery)*: a paid add-on that restores to any chosen
     moment.

   In the project dashboard, record which of the two (if either) is enabled,
   and note the time of the most recent daily backup or the earliest PITR time.
   If neither exists, the logical backup below is the only rollback.
2. **Logical backup (always):**
   - Schema and data for `public`, e.g. `pg_dump --schema=public --format=custom`.
   - `public.profiles` as CSV with **all** columns, including `username`,
     `is_dealer` and any extras:
     `\copy (select * from public.profiles) to 'profiles-<date>.csv' csv header`
   - `storage` schema metadata (buckets and policies). Object bytes are not in
     the database. The `listing-images` bucket must be empty anyway (§3).
   - Record a SHA-256 for every file. Store the files outside the repo,
     encrypted. They contain personal data.
3. **Auth.** A `public` + `storage` backup alone is **not** a full Auth backup.
   It does not contain `auth.users`, `auth.identities` or the other `auth`
   tables. The migration does not write Auth rows. Full rollback capability
   still needs one of these:
   - a platform backup (daily or PITR) covering the whole database;
   - a separate dump of the `auth` schema data, made with a role allowed to read
     it and handled under the same protection as credentials.

## 5. Restore test

Restore the logical backup into a **new** disposable database, never into an
existing stack or project. Then compare against the §3 outputs:
- row counts for `profiles` (and `auth.users` if Auth was dumped);
- an ordered digest such as
  `select md5(string_agg(t::text, '|' order by id)) from public.profiles t`.

A backup that has not been restored and compared does not count.

## 6. Rehearsal

The restored-clone run (§0) already exercised this exact file. Rehearse again
only if one of these has changed since that clone was taken:
- the production schema;
- the policies;
- the profile columns.

If you rehearse, use a fresh restore and the exact file, as in §7.

## 7. Apply (maintenance window)

- Announce the window and pause signups if possible. Signups and logins during
  the run either wait on locks or change the Auth digest, which aborts the run.
  Both outcomes are safe but cost a retry.
- Apply the reviewed file directly, with lock and statement timeouts. The
  operator supplies the connection. It is never committed or printed:

  ```sh
  PGOPTIONS='-c lock_timeout=5s -c statement_timeout=15min' \
    psql -v ON_ERROR_STOP=1 -f supabase/migrations/20260929144644_reconcile_august_schema_to_canonical.sql
  ```

- Do **not** use `supabase db push`. The remote history lacks `000`/`001`/`002`,
  so `push` would run `001` against the August schema first.
- Do **not** use any tool that saves the SQL as a new migration stamped with the
  current time. That is how the clone got `20261006065826`.
- On error, the whole block rolls back. Fix nothing in place; return to review.

## 8. Migration history: reviewed proposal only

**No history operation has been performed.** Nobody has run `migration repair`
or `db push`, or written to `schema_migrations`, on any project as part of this
work. The text below is a proposal that needs separate approval.

- **Preserve every existing row** in `supabase_migrations.schema_migrations`.
  Delete or rewrite nothing.
- For each remote-only August-era version, add a matching historical file to
  the repo (documented as already applied) so that `supabase migration list`
  agrees. Do not mark those versions reverted.
- Only after a successful apply, the §9 checks and review, record `000`, `001`,
  `002` and `20260929144644` as applied. The reconcile postconditions prove that
  the schema equals `001` + `002`, and `000` is a no-op on this schema.
  Proposed command:
  `supabase migration repair --status applied 000 001 002 20260929144644`.
- Never record `20261006065826` on production. Changes to the clone's history
  need their own approval.
- Use `supabase db push` only once `migration list` shows local and remote in
  agreement.

## 9. After the apply

- Re-run §3. Expect `phone_is_public` and `preferred_language` to be present,
  the legacy columns gone, and profile and Auth counts unchanged.
- Check that the canonical signup trigger exists on `auth.users`.
- Build the app with the target's `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` (inlined at build
  time). Deploy it to a preview before production, and run the seller lifecycle
  with a synthetic account.
- Keep the backups until the owner releases them.

## 10. Rollback

Use PITR or the most recent daily backup if one exists. Otherwise, restore the
§4 logical backup using the §5 procedure, which has been tested. Rollback
discards any data written after the apply, or after the snapshot for a daily
backup.

## 11. Open blockers

1. Owner decision on legacy field loss (`username`, `is_dealer`, extras).
2. Owner decision on `phone_is_public = true`.
3. Production migration history alignment (§8): proposal only.
4. No E2E run yet on a disposable local PG17 stack with the seller lifecycle
   actually executed.
5. The August source backup and catalogue export are not tracked, so the legacy
   path cannot be reproduced from this repository.
