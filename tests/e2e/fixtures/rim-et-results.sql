-- ===========================================================================
-- RATATAI E2E fixture: rim ET result matching (tests/e2e/rim-et-results.spec.ts)
-- ---------------------------------------------------------------------------
-- TEST ARTIFACT FOR A NEW, DISPOSABLE, LOCAL-ONLY SUPABASE STACK (PG17).
-- Never run it against a hosted project, staging or production. It is not a
-- migration and not part of supabase/seed.sql. See tests/e2e/fixtures/README.md.
--
-- Load it only through the local database container's Unix socket, with the
-- synthetic owner's email passed explicitly:
--
--   docker exec -i supabase_db_<project_id> \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--          -v owner_email=e2e-rim-owner@example.test < tests/e2e/fixtures/rim-et-results.sql
--
-- Guards (any failure aborts and rolls back; nothing is inserted):
--   * the connection must be a local socket or loopback, server must be PG17;
--   * owner_email must be supplied and match ^e2e-[a-z0-9-]+@example\.test$
--     (RFC 2606 reserved domain), an existing auth.users row with a profile;
--   * public.listings must be completely empty.
--
-- Contains no photos, phone numbers, contact data or real accounts.
-- Dispose afterwards with `supabase stop --no-backup` (or `supabase db reset`).
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

select set_config('rim_fixture.owner_email', :'owner_email', true);

do $$
declare
  owner_email text := nullif(current_setting('rim_fixture.owner_email', true), '');
  owner_id uuid;
  addr inet := inet_server_addr();
  n integer;
begin
  if addr is not null and not (addr <<= inet '127.0.0.0/8' or addr = inet '::1') then
    raise exception 'rim fixture: server address % is not a local socket or loopback; refusing.', addr;
  end if;

  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'rim fixture: expected PostgreSQL 17, found %; refusing.',
      current_setting('server_version');
  end if;

  if owner_email is null then
    raise exception 'rim fixture: pass -v owner_email=<synthetic local user>; refusing.';
  end if;

  if owner_email !~ '^e2e-[a-z0-9-]+@example\.test$' then
    raise exception 'rim fixture: % is not a synthetic e2e-*@example.test owner; refusing.', owner_email;
  end if;

  select id into owner_id from auth.users where lower(email) = owner_email;
  if owner_id is null then
    raise exception 'rim fixture: no local auth user %; provision it first; refusing.', owner_email;
  end if;

  if not exists (select 1 from public.profiles where id = owner_id) then
    raise exception 'rim fixture: auth user % has no profile row; refusing.', owner_email;
  end if;

  select count(*) into n from public.listings;
  if n <> 0 then
    raise exception 'rim fixture: public.listings holds % row(s); a fresh empty catalog is required; refusing.', n;
  end if;

  -- One row per case. Slugs are the identities the spec asserts. All rims are
  -- otherwise identical, so only the noted column decides whether they match.
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, moderation_status, slug
  )
  select
    owner_id,
    'ratlankiai',
    'E2E rim ' || c.slug,
    'Synthetic E2E fixture rim, no photos or contact data.',
    'used',
    100.00,
    4,
    'Vilnius',
    jsonb_build_object(
      'brand', 'E2E',
      'diameter', c.diameter,
      'rim_width', 7.5,
      'bolt_count', c.bolt_count,
      'pcd', c.pcd,
      'cb', c.cb,
      'et', c.et,
      'material', 'alloy'
    ),
    c.status,
    c.moderation,
    c.slug
  from (values
    -- Public, matching PCD 5x112 / CB 57.1 / R17; ET at the boundaries.
    ('e2e-rim-et-m10',            17, 5, '5x112',   57.1, -10, 'active',   'approved'),
    ('e2e-rim-et-0',              17, 5, '5x112',   57.1,   0, 'active',   'approved'),
    ('e2e-rim-et-40',             17, 5, '5x112',   57.1,  40, 'active',   'approved'),
    -- Public, matching technical fields; ET just outside -10..40.
    ('e2e-rim-et-m11',            17, 5, '5x112',   57.1, -11, 'active',   'approved'),
    ('e2e-rim-et-41',             17, 5, '5x112',   57.1,  41, 'active',   'approved'),
    -- Public, ET inside the range; one technical field differs.
    ('e2e-rim-other-pcd',         17, 5, '5x114.3', 57.1,  20, 'active',   'approved'),
    ('e2e-rim-other-cb',          17, 5, '5x112',   66.6,  20, 'active',   'approved'),
    ('e2e-rim-other-diameter',    18, 5, '5x112',   57.1,  20, 'active',   'approved'),
    -- Not public: fully matching, but must never appear in the catalog.
    ('e2e-rim-hidden-draft',      17, 5, '5x112',   57.1,  20, 'draft',    'approved'),
    ('e2e-rim-hidden-sold',       17, 5, '5x112',   57.1,  20, 'sold',     'approved'),
    ('e2e-rim-hidden-archived',   17, 5, '5x112',   57.1,  20, 'archived', 'approved'),
    ('e2e-rim-hidden-pending',    17, 5, '5x112',   57.1,  20, 'active',   'pending'),
    ('e2e-rim-hidden-rejected',   17, 5, '5x112',   57.1,  20, 'active',   'rejected')
  ) as c(slug, diameter, bolt_count, pcd, cb, et, status, moderation);

  get diagnostics n = row_count;
  if n <> 13 then
    raise exception 'rim fixture: inserted % rows, expected 13; rolling back.', n;
  end if;
end;
$$;

commit;
