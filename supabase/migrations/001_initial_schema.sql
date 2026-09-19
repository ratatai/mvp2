-- ===========================================================================
-- RATATAI marketplace — 001 initial schema
-- ---------------------------------------------------------------------------
-- Canonical data contract for a classifieds board selling tires (padangos),
-- rims (ratlankiai) and complete wheels (komplektiniai_ratai).
--
-- This migration is additive and non-destructive: it creates tables only if
-- they do not exist. Projects that already ran the legacy lean-MVP migrations
-- must additionally run 003_legacy_compatibility.sql, which converts the old
-- column names and values to this contract without deleting any rows.
--
-- Canonical values (never translated, never stored as UI strings):
--   category          padangos | ratlankiai | komplektiniai_ratai
--   condition         new | used
--   status            draft | active | sold | archived
--   moderation_status pending | approved | rejected
--   season (in specs) summer | winter | all_season
--   material (specs)  alloy | steel | forged
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers. search_path is pinned on every function so that a
-- malicious schema earlier on the path cannot hijack the function body.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_published_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Stamp the first transition into the public catalog and never clear it,
  -- so that a listing which is sold and re-activated keeps its original date.
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per authenticated user. Email is deliberately NOT stored here: it
-- lives in auth.users and must never reach a public response.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  phone_is_public boolean not null default true,
  preferred_language text not null default 'lt'
    check (preferred_language in ('lt', 'ru', 'en')),
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row automatically when a user signs up, so that the app
-- never has to run with elevated privileges just to bootstrap a seller.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'preferred_language', '')), ''),
      'lt'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- listings
-- Category-specific technical data lives in `specs` (JSONB). The exact shape
-- per category is validated at the application boundary (Zod schemas in
-- src/domain/listing.validation.ts); the database only guarantees that specs
-- is a non-empty JSON object.
-- ---------------------------------------------------------------------------

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null
    check (category in ('padangos', 'ratlankiai', 'komplektiniai_ratai')),
  title text not null check (length(btrim(title)) between 3 and 140),
  description text not null check (length(btrim(description)) between 10 and 5000),
  condition text not null check (condition in ('new', 'used')),
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  quantity integer not null check (quantity > 0 and quantity <= 100),
  country text not null default 'LT' check (length(country) = 2),
  city text not null check (length(btrim(city)) > 0),
  area text,
  specs jsonb not null
    check (jsonb_typeof(specs) = 'object' and specs <> '{}'::jsonb),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'sold', 'archived')),
  -- The moderation column exists so the contract is future-proof, but the MVP
  -- ships without a moderation panel and therefore auto-approves. Switch the
  -- default to 'pending' the day a moderation queue is introduced.
  moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists listings_set_published_at on public.listings;
create trigger listings_set_published_at
  before insert or update on public.listings
  for each row execute function public.set_published_at();

-- Public catalog: newest first, only rows the anonymous visitor may see.
create index if not exists listings_public_created_at_idx
  on public.listings (created_at desc)
  where status = 'active' and moderation_status = 'approved';

-- Public catalog sorted by price (both directions use the same b-tree).
create index if not exists listings_public_price_idx
  on public.listings (price)
  where status = 'active' and moderation_status = 'approved';

-- Category tabs.
create index if not exists listings_category_created_at_idx
  on public.listings (category, created_at desc);

-- Owner dashboard.
create index if not exists listings_user_id_created_at_idx
  on public.listings (user_id, created_at desc);

-- Technical filters are expressed as containment queries on specs.
create index if not exists listings_specs_gin_idx
  on public.listings using gin (specs jsonb_path_ops);

-- Free-text search over title/city without an external search engine.
create index if not exists listings_title_trgm_idx
  on public.listings (lower(title) text_pattern_ops);

-- ---------------------------------------------------------------------------
-- listing_images
-- At most one primary image per listing, at most 10 images per listing.
-- ---------------------------------------------------------------------------

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  position integer not null default 0 check (position >= 0 and position < 10),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists listing_images_listing_position_idx
  on public.listing_images (listing_id, position, created_at);

-- Hard guarantee: never more than one primary image per listing.
create unique index if not exists listing_images_one_primary_idx
  on public.listing_images (listing_id)
  where is_primary;

create or replace function public.enforce_listing_image_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  image_count integer;
begin
  select count(*) into image_count
  from public.listing_images
  where listing_id = new.listing_id;

  if image_count >= 10 then
    raise exception 'listing % already has the maximum of 10 images', new.listing_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_images_limit on public.listing_images;
create trigger listing_images_limit
  before insert on public.listing_images
  for each row execute function public.enforce_listing_image_limit();

-- ---------------------------------------------------------------------------
-- listing_sellers
-- The only seller data a public visitor may read. It deliberately exposes no
-- email and no auth identifier, and hides the phone number when the seller
-- chose to keep it private. Defined as a SECURITY DEFINER view (the default)
-- so it can read profiles while profiles itself stays owner-only under RLS;
-- the WHERE clause is what limits the exposed rows.
-- ---------------------------------------------------------------------------

create or replace view public.listing_sellers as
select
  l.id as listing_id,
  p.display_name,
  p.city,
  case when p.phone_is_public then p.phone else null end as phone
from public.listings l
join public.profiles p on p.id = l.user_id
where l.status = 'active'
  and l.moderation_status = 'approved';

comment on view public.listing_sellers is
  'Public seller data per active listing. Never exposes email or user UUID.';
