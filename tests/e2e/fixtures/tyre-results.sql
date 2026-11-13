-- ===========================================================================
-- RATATAI E2E fixture: plain tyre result matching
-- (tests/e2e/tyre-results.spec.ts)
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
--          -v owner_email=e2e-tyre-owner@example.test < tests/e2e/fixtures/tyre-results.sql
--
-- Guards (any failure aborts and rolls back; nothing is inserted):
--   * the connection must be a local socket or loopback, server must be PG17;
--   * owner_email must be supplied and match ^e2e-[a-z0-9-]+@example\.test$
--     (RFC 2606 reserved domain), an existing auth.users row with a profile;
--   * public.listings must be completely empty.
--
-- Plain tyres use the canonical flat shape (tireSpecsSchema, strict) with
-- canonical season values. One complete wheel (nested specs) and one plain
-- rim that would match the tyre query by size/diameter are included as
-- decoys; they must never appear on the tyre route.
--
-- Contains no photos, phone numbers, contact data or real accounts.
-- Dispose afterwards with `supabase stop --no-backup` (or `supabase db reset`).
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

select set_config('tyre_fixture.owner_email', :'owner_email', true);

do $$
declare
  owner_email text := nullif(current_setting('tyre_fixture.owner_email', true), '');
  owner_id uuid;
  addr inet := inet_server_addr();
  n integer;
  total integer := 0;
begin
  if addr is not null and not (addr <<= inet '127.0.0.0/8' or addr = inet '::1') then
    raise exception 'tyre fixture: server address % is not a local socket or loopback; refusing.', addr;
  end if;

  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'tyre fixture: expected PostgreSQL 17, found %; refusing.',
      current_setting('server_version');
  end if;

  if owner_email is null then
    raise exception 'tyre fixture: pass -v owner_email=<synthetic local user>; refusing.';
  end if;

  if owner_email !~ '^e2e-[a-z0-9-]+@example\.test$' then
    raise exception 'tyre fixture: % is not a synthetic e2e-*@example.test owner; refusing.', owner_email;
  end if;

  select id into owner_id from auth.users where lower(email) = owner_email;
  if owner_id is null then
    raise exception 'tyre fixture: no local auth user %; provision it first; refusing.', owner_email;
  end if;

  if not exists (select 1 from public.profiles where id = owner_id) then
    raise exception 'tyre fixture: auth user % has no profile row; refusing.', owner_email;
  end if;

  select count(*) into n from public.listings;
  if n <> 0 then
    raise exception 'tyre fixture: public.listings holds % row(s); a fresh empty catalog is required; refusing.', n;
  end if;

  -- Plain tyres. Slugs are the identities the spec asserts. The baseline is
  -- 205/55 R16; each near-miss row changes exactly one size field.
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, moderation_status, slug
  )
  select
    owner_id,
    'padangos',
    'E2E tyre ' || c.slug,
    'Synthetic E2E fixture tyre, no photos or contact data.',
    'used',
    100.00,
    4,
    'Vilnius',
    jsonb_build_object(
      'brand', 'E2E',
      'width', c.width,
      'aspect_ratio', c.aspect_ratio,
      'diameter', c.diameter,
      'season', c.season
    ),
    c.status,
    c.moderation,
    c.slug
  from (values
    -- Public, size 205/55 R16 matches; one per canonical season.
    ('e2e-tyre-match-summer',     205, 55, 16, 'summer',     'active',   'approved'),
    ('e2e-tyre-match-winter',     205, 55, 16, 'winter',     'active',   'approved'),
    ('e2e-tyre-match-all-season', 205, 55, 16, 'all_season', 'active',   'approved'),
    -- Public, exactly one size field differs.
    ('e2e-tyre-other-width',      215, 55, 16, 'summer',     'active',   'approved'),
    ('e2e-tyre-other-aspect',     205, 60, 16, 'summer',     'active',   'approved'),
    ('e2e-tyre-other-diameter',   205, 55, 17, 'summer',     'active',   'approved'),
    -- Public, valid wide tyres: width is not capped at 305.
    ('e2e-tyre-wide-355',         355, 25, 22, 'summer',     'active',   'approved'),
    ('e2e-tyre-wide-375',         375, 40, 22, 'winter',     'active',   'approved'),
    -- Not public: size matches, but must never appear in the catalog.
    ('e2e-tyre-hidden-draft',     205, 55, 16, 'summer',     'draft',    'approved'),
    ('e2e-tyre-hidden-sold',      205, 55, 16, 'summer',     'sold',     'approved'),
    ('e2e-tyre-hidden-archived',  205, 55, 16, 'summer',     'archived', 'approved'),
    ('e2e-tyre-hidden-pending',   205, 55, 16, 'summer',     'active',   'pending'),
    ('e2e-tyre-hidden-rejected',  205, 55, 16, 'summer',     'active',   'rejected')
  ) as c(slug, width, aspect_ratio, diameter, season, status, moderation);

  get diagnostics n = row_count;
  total := total + n;

  -- Category decoys that would match the tyre query by size or diameter. They
  -- are valid in their own categories and must stay out of the tyre results.
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, moderation_status, slug
  ) values
  (
    owner_id, 'komplektiniai_ratai', 'E2E decoy wheel e2e-decoy-wheel',
    'Synthetic E2E fixture wheel set, no photos or contact data.',
    'used', 400.00, 4, 'Vilnius',
    jsonb_build_object(
      'tire', jsonb_build_object(
        'brand', 'E2E', 'width', 205, 'aspect_ratio', 55, 'diameter', 16,
        'season', 'summer'
      ),
      'rim', jsonb_build_object(
        'brand', 'E2E', 'diameter', 16, 'rim_width', 6.5, 'bolt_count', 5,
        'pcd', '5x112', 'cb', 57.1, 'et', 40, 'material', 'alloy'
      )
    ),
    'active', 'approved', 'e2e-decoy-wheel'
  ),
  (
    owner_id, 'ratlankiai', 'E2E decoy rim e2e-decoy-rim',
    'Synthetic E2E fixture rim, no photos or contact data.',
    'used', 100.00, 4, 'Vilnius',
    jsonb_build_object(
      'brand', 'E2E', 'diameter', 16, 'rim_width', 6.5, 'bolt_count', 5,
      'pcd', '5x112', 'cb', 57.1, 'et', 40, 'material', 'alloy'
    ),
    'active', 'approved', 'e2e-decoy-rim'
  );

  get diagnostics n = row_count;
  total := total + n;

  if total <> 15 then
    raise exception 'tyre fixture: inserted % rows, expected 15; rolling back.', total;
  end if;
end;
$$;

commit;
