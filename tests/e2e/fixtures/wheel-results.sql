-- ===========================================================================
-- RATATAI E2E fixture: complete-wheel result matching
-- (tests/e2e/wheel-results.spec.ts)
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
--          -v owner_email=e2e-wheel-owner@example.test < tests/e2e/fixtures/wheel-results.sql
--
-- Guards (any failure aborts and rolls back; nothing is inserted):
--   * the connection must be a local socket or loopback, server must be PG17;
--   * owner_email must be supplied and match ^e2e-[a-z0-9-]+@example\.test$
--     (RFC 2606 reserved domain), an existing auth.users row with a profile;
--   * public.listings must be completely empty.
--
-- Complete wheels use the canonical nested shape { "tire": {...}, "rim": {...} }
-- (wheelSpecsSchema, strict) with the same diameter on both halves. One plain
-- tyre and one plain rim with top-level specs that would match the wheel
-- query are included as decoys; they must never appear on the wheel route.
--
-- Contains no photos, phone numbers, contact data or real accounts.
-- Dispose afterwards with `supabase stop --no-backup` (or `supabase db reset`).
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

select set_config('wheel_fixture.owner_email', :'owner_email', true);

do $$
declare
  owner_email text := nullif(current_setting('wheel_fixture.owner_email', true), '');
  owner_id uuid;
  addr inet := inet_server_addr();
  n integer;
  total integer := 0;
begin
  if addr is not null and not (addr <<= inet '127.0.0.0/8' or addr = inet '::1') then
    raise exception 'wheel fixture: server address % is not a local socket or loopback; refusing.', addr;
  end if;

  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'wheel fixture: expected PostgreSQL 17, found %; refusing.',
      current_setting('server_version');
  end if;

  if owner_email is null then
    raise exception 'wheel fixture: pass -v owner_email=<synthetic local user>; refusing.';
  end if;

  if owner_email !~ '^e2e-[a-z0-9-]+@example\.test$' then
    raise exception 'wheel fixture: % is not a synthetic e2e-*@example.test owner; refusing.', owner_email;
  end if;

  select id into owner_id from auth.users where lower(email) = owner_email;
  if owner_id is null then
    raise exception 'wheel fixture: no local auth user %; provision it first; refusing.', owner_email;
  end if;

  if not exists (select 1 from public.profiles where id = owner_id) then
    raise exception 'wheel fixture: auth user % has no profile row; refusing.', owner_email;
  end if;

  select count(*) into n from public.listings;
  if n <> 0 then
    raise exception 'wheel fixture: public.listings holds % row(s); a fresh empty catalog is required; refusing.', n;
  end if;

  -- Complete wheels. Slugs are the identities the spec asserts. The baseline
  -- is tyre 225/45 R17 on a 7.5J R17 5x112 CB 57.1 rim; each near-miss row
  -- changes exactly one searched field (diameter changes on both halves,
  -- because a wheel's halves must share it).
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, moderation_status, slug
  )
  select
    owner_id,
    'komplektiniai_ratai',
    'E2E wheel ' || c.slug,
    'Synthetic E2E fixture wheel set, no photos or contact data.',
    'used',
    400.00,
    4,
    'Vilnius',
    jsonb_build_object(
      'tire', jsonb_build_object(
        'brand', 'E2E',
        'width', c.width,
        'aspect_ratio', c.aspect_ratio,
        'diameter', c.diameter,
        'season', 'summer'
      ),
      'rim', jsonb_build_object(
        'brand', 'E2E',
        'diameter', c.diameter,
        'rim_width', 7.5,
        'bolt_count', 5,
        'pcd', c.pcd,
        'cb', c.cb,
        'et', c.et,
        'material', 'alloy'
      )
    ),
    c.status,
    c.moderation,
    c.slug
  from (values
    -- Public, every field matches; ET at the -10..40 boundaries.
    ('e2e-wheel-et-m10',          225, 45, 17, '5x112',   57.1, -10, 'active', 'approved'),
    ('e2e-wheel-et-0',            225, 45, 17, '5x112',   57.1,   0, 'active', 'approved'),
    ('e2e-wheel-et-40',           225, 45, 17, '5x112',   57.1,  40, 'active', 'approved'),
    -- Public, technical fields match; ET just outside -10..40.
    ('e2e-wheel-et-m11',          225, 45, 17, '5x112',   57.1, -11, 'active', 'approved'),
    ('e2e-wheel-et-41',           225, 45, 17, '5x112',   57.1,  41, 'active', 'approved'),
    -- Public, ET inside the range; exactly one technical field differs.
    ('e2e-wheel-other-width',     235, 45, 17, '5x112',   57.1,  20, 'active', 'approved'),
    ('e2e-wheel-other-aspect',    225, 40, 17, '5x112',   57.1,  20, 'active', 'approved'),
    ('e2e-wheel-other-diameter',  225, 45, 18, '5x112',   57.1,  20, 'active', 'approved'),
    ('e2e-wheel-other-pcd',       225, 45, 17, '5x114.3', 57.1,  20, 'active', 'approved'),
    ('e2e-wheel-other-cb',        225, 45, 17, '5x112',   66.6,  20, 'active', 'approved'),
    -- Public, valid wide tyre: width is not capped at 305.
    ('e2e-wheel-wide-355',        355, 25, 22, '5x112',   57.1,  30, 'active', 'approved'),
    -- Not public: fully matching, but must never appear in the catalog.
    ('e2e-wheel-hidden-draft',    225, 45, 17, '5x112',   57.1,  20, 'draft',  'approved'),
    ('e2e-wheel-hidden-pending',  225, 45, 17, '5x112',   57.1,  20, 'active', 'pending')
  ) as c(slug, width, aspect_ratio, diameter, pcd, cb, et, status, moderation);

  get diagnostics n = row_count;
  total := total + n;

  -- Category decoys with flat, top-level specs that would match the wheel
  -- query. They are valid in their own categories and must stay out of the
  -- complete-wheel results.
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, moderation_status, slug
  ) values
  (
    owner_id, 'padangos', 'E2E decoy tyre e2e-decoy-tyre',
    'Synthetic E2E fixture tyre, no photos or contact data.',
    'used', 100.00, 4, 'Vilnius',
    jsonb_build_object(
      'brand', 'E2E', 'width', 225, 'aspect_ratio', 45, 'diameter', 17,
      'season', 'summer'
    ),
    'active', 'approved', 'e2e-decoy-tyre'
  ),
  (
    owner_id, 'ratlankiai', 'E2E decoy rim e2e-decoy-rim',
    'Synthetic E2E fixture rim, no photos or contact data.',
    'used', 100.00, 4, 'Vilnius',
    jsonb_build_object(
      'brand', 'E2E', 'diameter', 17, 'rim_width', 7.5, 'bolt_count', 5,
      'pcd', '5x112', 'cb', 57.1, 'et', 0, 'material', 'alloy'
    ),
    'active', 'approved', 'e2e-decoy-rim'
  );

  get diagnostics n = row_count;
  total := total + n;

  if total <> 15 then
    raise exception 'wheel fixture: inserted % rows, expected 15; rolling back.', total;
  end if;
end;
$$;

commit;
