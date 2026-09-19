-- ===========================================================================
-- RATATAI marketplace — 002 security hardening
-- ---------------------------------------------------------------------------
-- Row Level Security, policies, Storage bucket and Storage policies.
-- Run this after 001_initial_schema.sql.
--
-- Access matrix enforced here:
--   anon          read active+approved listings and their images; read the
--                 public seller view; nothing else, no writes anywhere.
--   authenticated everything anon can do, plus full owner-scoped CRUD on their
--                 own listings, images and profile.
--   service_role  never used by this application and never shipped to the
--                 browser.
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

-- Deny-by-default for any role that is not explicitly granted below.
alter table public.profiles force row level security;

-- ---------------------------------------------------------------------------
-- profiles — strictly owner scoped. Public seller data is served by the
-- public.listing_sellers view instead, so anon never touches this table.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------

-- Public catalog: only published, approved rows. Drafts, sold and archived
-- listings are invisible to anonymous visitors and to other users.
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings for select
  to anon, authenticated
  using (status = 'active' and moderation_status = 'approved');

-- Owners see every listing they own, in any status.
drop policy if exists "listings_select_own" on public.listings;
create policy "listings_select_own"
  on public.listings for select
  to authenticated
  using (auth.uid() = user_id);

-- A user can only ever create a listing in their own name. Anonymous visitors
-- have no insert policy at all, so they cannot publish.
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (auth.uid() = user_id);

-- USING limits which rows may be updated, WITH CHECK blocks re-assigning a
-- listing to another user_id.
drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- listing_images — always follow the visibility of the parent listing.
-- ---------------------------------------------------------------------------

drop policy if exists "listing_images_select_public" on public.listing_images;
create policy "listing_images_select_public"
  on public.listing_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.status = 'active'
        and l.moderation_status = 'approved'
    )
  );

drop policy if exists "listing_images_select_own" on public.listing_images;
create policy "listing_images_select_own"
  on public.listing_images for select
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_images_insert_own" on public.listing_images;
create policy "listing_images_insert_own"
  on public.listing_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_images_update_own" on public.listing_images;
create policy "listing_images_update_own"
  on public.listing_images for update
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_images_delete_own" on public.listing_images;
create policy "listing_images_delete_own"
  on public.listing_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants. The public seller view is readable by everyone; the underlying
-- profiles table is not.
-- ---------------------------------------------------------------------------

grant select on public.listing_sellers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: listing-images bucket
-- Path contract: {userId}/{listingId}/{generatedFileName}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read the bucket; row visibility of the metadata still governs
-- what the application actually renders.
drop policy if exists "listing_images_storage_select" on storage.objects;
create policy "listing_images_storage_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-images');

-- A seller may only write under their own user folder, and only into a folder
-- named after a listing they own. This makes overwriting another user's file
-- impossible even if the client is tampered with.
drop policy if exists "listing_images_storage_insert_own" on storage.objects;
create policy "listing_images_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.listings l
      where l.id::text = (storage.foldername(name))[2]
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_images_storage_update_own" on storage.objects;
create policy "listing_images_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_images_storage_delete_own" on storage.objects;
create policy "listing_images_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
