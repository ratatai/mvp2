-- ===========================================================================
-- RATATAI marketplace — 000 legacy compatibility (OPTIONAL)
-- ---------------------------------------------------------------------------
-- Run this ONLY on a Supabase project that already ran the old lean-MVP
-- migrations (20260528192000_initial_marketplace.sql and friends), and run it
-- BEFORE 001_initial_schema.sql.
--
-- On a fresh project this file does nothing at all.
--
-- The old schema is incompatible with the canonical contract in 001:
--
--   old                                 new
--   -------------------------------     -----------------------------------
--   listings.seller_id                  listings.user_id
--   category 'ratai'                    category 'komplektiniai_ratai'
--   flat text columns (tire_width,      specs jsonb, validated per category
--     bolt_spacing, center_bore,        at the application boundary
--     offset_et, ...)
--   no currency/country/slug/           currency, country, slug, updated_at,
--     updated_at/published_at             published_at, moderation_status
--   listing_images.sort_order           listing_images.position + is_primary
--   listing_images.image_url            listing_images.public_url
--
-- NOTHING IS DELETED. The old tables are renamed to legacy_* so that every
-- existing row stays readable, and 001 then creates the new tables cleanly.
-- Inspect the archived data with:
--     select * from public.legacy_listings;
-- and drop the legacy tables yourself once you are sure you no longer need
-- them. This migration performs no DROP TABLE and no DELETE.
-- ===========================================================================

do $$
declare
  has_legacy_listings boolean;
  has_legacy_profiles boolean;
  has_legacy_images boolean;
begin
  -- The unmistakable marker of the old schema is listings.seller_id.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'seller_id'
  ) into has_legacy_listings;

  if not has_legacy_listings then
    raise notice 'RATATAI: no legacy schema detected, nothing to archive.';
    return;
  end if;

  raise notice 'RATATAI: legacy schema detected, archiving to legacy_* tables.';

  -- Images first: the FK points at listings.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_images'
      and column_name = 'sort_order'
  ) into has_legacy_images;

  if has_legacy_images then
    execute 'alter table public.listing_images rename to legacy_listing_images';
  end if;

  execute 'alter table public.listings rename to legacy_listings';

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) into has_legacy_profiles;

  if has_legacy_profiles then
    execute 'alter table public.profiles rename to legacy_profiles';
  end if;
end $$;

-- Keep the archived rows readable to their owners only; no anonymous access.
do $$
begin
  if to_regclass('public.legacy_listings') is not null then
    execute 'alter table public.legacy_listings enable row level security';
  end if;
  if to_regclass('public.legacy_profiles') is not null then
    execute 'alter table public.legacy_profiles enable row level security';
  end if;
  if to_regclass('public.legacy_listing_images') is not null then
    execute 'alter table public.legacy_listing_images enable row level security';
  end if;
end $$;

comment on schema public is
  'RATATAI marketplace. legacy_* tables, when present, are archived rows from the pre-contract lean MVP and are not used by the application.';
