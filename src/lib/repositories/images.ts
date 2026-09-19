import 'server-only';

/**
 * Listing image metadata and Storage housekeeping.
 *
 * Two invariants are maintained here:
 *   • metadata never exists without a Storage object — a failed metadata
 *     insert deletes the object that was just uploaded;
 *   • a Storage object never exists without metadata — deleting an image
 *     removes the row and the object together.
 */

import {
  MAX_IMAGES_PER_LISTING,
  type ListingImage,
} from '@/domain/listing.contract';
import { rowToImage, sortImages } from '@/domain/listing.mapper';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { RepoResult } from './listings';

export const LISTING_IMAGES_BUCKET = 'listing-images';

function logImageIssue(scope: string, detail: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[images:${scope}]`, detail);
  }
}

/** Confirms the listing belongs to the user before any image write. */
async function assertOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  listingId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('user_id', userId)
    .maybeSingle();

  return data !== null;
}

export async function fetchListingImages(
  listingId: string
): Promise<readonly ListingImage[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('listing_images')
    .select('*')
    .eq('listing_id', listingId)
    .order('position', { ascending: true });

  if (error !== null) {
    logImageIssue('fetchListingImages', error);
    return [];
  }

  return sortImages((data ?? []).map(rowToImage));
}

/** Physically removes objects from the bucket. Safe to call with an empty list. */
export async function removeStorageObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .remove([...paths]);

  if (error !== null) logImageIssue('removeStorageObjects', error);
}

export interface NewImageInput {
  readonly storagePath: string;
  readonly publicUrl: string;
}

/**
 * Records freshly uploaded images. The first image of an empty listing becomes
 * the primary one automatically; nothing else is invented.
 *
 * If the metadata insert fails, the uploaded objects are deleted again so the
 * bucket does not accumulate files that no listing references.
 */
export async function addImages(
  listingId: string,
  userId: string,
  images: readonly NewImageInput[]
): Promise<RepoResult<readonly ListingImage[]>> {
  if (images.length === 0) return { ok: true, data: [] };

  const supabase = await createSupabaseServerClient();

  if (!(await assertOwnership(supabase, listingId, userId))) {
    await removeStorageObjects(images.map((image) => image.storagePath));
    return { ok: false, error: 'forbidden' };
  }

  const { data: existing } = await supabase
    .from('listing_images')
    .select('id, position, is_primary')
    .eq('listing_id', listingId);

  const current = existing ?? [];

  if (current.length + images.length > MAX_IMAGES_PER_LISTING) {
    await removeStorageObjects(images.map((image) => image.storagePath));
    return { ok: false, error: 'validation' };
  }

  const hasPrimary = current.some((row) => row.is_primary);
  const nextPosition = current.reduce(
    (max, row) => Math.max(max, row.position + 1),
    0
  );

  const payload = images.map((image, index) => ({
    listing_id: listingId,
    storage_path: image.storagePath,
    public_url: image.publicUrl,
    position: nextPosition + index,
    is_primary: !hasPrimary && index === 0,
  }));

  const { data, error } = await supabase
    .from('listing_images')
    .insert(payload)
    .select('*');

  if (error !== null) {
    // Roll back the upload so metadata and Storage stay consistent.
    await removeStorageObjects(images.map((image) => image.storagePath));
    logImageIssue('addImages', error);
    return { ok: false, error: 'unavailable' };
  }

  return { ok: true, data: sortImages((data ?? []).map(rowToImage)) };
}

/** Deletes one image: metadata first, then the object. */
export async function removeImage(
  listingId: string,
  userId: string,
  imageId: string
): Promise<RepoResult<null>> {
  const supabase = await createSupabaseServerClient();

  if (!(await assertOwnership(supabase, listingId, userId))) {
    return { ok: false, error: 'forbidden' };
  }

  const { data: row } = await supabase
    .from('listing_images')
    .select('storage_path, is_primary')
    .eq('id', imageId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (row === null) return { ok: false, error: 'not_found' };

  const { error } = await supabase
    .from('listing_images')
    .delete()
    .eq('id', imageId)
    .eq('listing_id', listingId);

  if (error !== null) {
    logImageIssue('removeImage', error);
    return { ok: false, error: 'unavailable' };
  }

  await removeStorageObjects([row.storage_path]);

  // Promote the next photo so a listing with pictures always has a primary.
  if (row.is_primary) {
    const { data: remaining } = await supabase
      .from('listing_images')
      .select('id')
      .eq('listing_id', listingId)
      .order('position', { ascending: true })
      .limit(1);

    const next = remaining?.[0];
    if (next !== undefined) {
      await supabase
        .from('listing_images')
        .update({ is_primary: true })
        .eq('id', next.id);
    }
  }

  return { ok: true, data: null };
}

/**
 * Makes one image primary. The previous primary is cleared first, because the
 * partial unique index allows only a single primary row per listing.
 */
export async function setPrimaryImage(
  listingId: string,
  userId: string,
  imageId: string
): Promise<RepoResult<null>> {
  const supabase = await createSupabaseServerClient();

  if (!(await assertOwnership(supabase, listingId, userId))) {
    return { ok: false, error: 'forbidden' };
  }

  const { error: clearError } = await supabase
    .from('listing_images')
    .update({ is_primary: false })
    .eq('listing_id', listingId)
    .eq('is_primary', true);

  if (clearError !== null) {
    logImageIssue('setPrimaryImage:clear', clearError);
    return { ok: false, error: 'unavailable' };
  }

  const { error, count } = await supabase
    .from('listing_images')
    .update({ is_primary: true }, { count: 'exact' })
    .eq('id', imageId)
    .eq('listing_id', listingId);

  if (error !== null) {
    logImageIssue('setPrimaryImage:set', error);
    return { ok: false, error: 'unavailable' };
  }

  if (count === 0) return { ok: false, error: 'not_found' };

  return { ok: true, data: null };
}

/**
 * Applies a new order. Positions are rewritten from the given sequence, so the
 * caller only has to send the ids in the order the seller arranged them.
 */
export async function reorderImages(
  listingId: string,
  userId: string,
  orderedIds: readonly string[]
): Promise<RepoResult<null>> {
  const supabase = await createSupabaseServerClient();

  if (!(await assertOwnership(supabase, listingId, userId))) {
    return { ok: false, error: 'forbidden' };
  }

  if (orderedIds.length > MAX_IMAGES_PER_LISTING) {
    return { ok: false, error: 'validation' };
  }

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from('listing_images')
      .update({ position: index })
      .eq('id', id)
      .eq('listing_id', listingId);

    if (error !== null) {
      logImageIssue('reorderImages', error);
      return { ok: false, error: 'unavailable' };
    }
  }

  return { ok: true, data: null };
}
