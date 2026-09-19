'use server';

/**
 * Listing and image server actions.
 *
 * Every action re-checks the session and scopes the write to the signed-in
 * user. The client is never trusted with a user id, and RLS enforces the same
 * rule a second time in the database.
 *
 * Actions return codes and validation issue strings — never raw database
 * errors — so the UI can translate them.
 */

import { revalidatePath } from 'next/cache';

import type { ListingStatus } from '@/domain/canonical';
import { isListingStatus } from '@/domain/canonical';
import type { ListingDraft } from '@/domain/listing.contract';
import { parseListingDraft } from '@/domain/listing.validation';
import {
  addImages,
  removeImage,
  removeStorageObjects,
  reorderImages,
  setPrimaryImage,
} from '@/lib/repositories/images';
import {
  createListing,
  deleteListing,
  setListingStatus,
  updateListing,
  type RepoError,
} from '@/lib/repositories/listings';
import { getSessionUser } from '@/lib/supabase/server';

export type ActionResult<T = null> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: RepoError;
      readonly issues?: readonly string[];
    };

const NOT_AUTHENTICATED = {
  ok: false as const,
  error: 'not_authenticated' as const,
};

/* -------------------------------------------------------------------------- */
/* Listing writes                                                              */
/* -------------------------------------------------------------------------- */

export interface SavedListing {
  readonly id: string;
  readonly slug: string;
}

/**
 * Creates the listing as a draft. Photos are uploaded afterwards, because the
 * Storage path contract is {userId}/{listingId}/{file} and the listing id has
 * to exist first.
 */
export async function createDraftAction(
  input: unknown
): Promise<ActionResult<SavedListing>> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const parsed = parseListingDraft(input);
  if (!parsed.ok) {
    return { ok: false, error: 'validation', issues: parsed.issues };
  }

  const result = await createListing(
    parsed.draft as ListingDraft,
    user.id,
    'draft'
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/[locale]/mano/skelbimai', 'page');

  return { ok: true, data: result.data };
}

export async function updateListingAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ readonly slug: string }>> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const parsed = parseListingDraft(input);
  if (!parsed.ok) {
    return { ok: false, error: 'validation', issues: parsed.issues };
  }

  const result = await updateListing(id, user.id, parsed.draft as ListingDraft);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/[locale]/mano/skelbimai', 'page');
  revalidatePath(`/[locale]/skelbimas/${result.data.slug}`, 'page');

  return { ok: true, data: result.data };
}

export async function changeStatusAction(
  id: string,
  status: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  if (!isListingStatus(status)) {
    return { ok: false, error: 'validation' };
  }

  const result = await setListingStatus(id, user.id, status as ListingStatus);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/[locale]/mano/skelbimai', 'page');
  revalidatePath('/[locale]/skelbimai', 'page');

  return { ok: true, data: null };
}

export async function deleteListingAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const result = await deleteListing(id, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  // The metadata rows are gone via cascade; remove the objects too so the
  // bucket never keeps files that nothing references.
  await removeStorageObjects(result.data);

  revalidatePath('/[locale]/mano/skelbimai', 'page');
  revalidatePath('/[locale]/skelbimai', 'page');

  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* Image writes                                                                */
/* -------------------------------------------------------------------------- */

export interface UploadedImageInput {
  readonly storagePath: string;
  readonly publicUrl: string;
}

export async function registerImagesAction(
  listingId: string,
  images: readonly UploadedImageInput[]
): Promise<ActionResult<readonly { id: string; public_url: string; position: number; is_primary: boolean }[]>> {
  const user = await getSessionUser();

  if (user === null) {
    // The objects were already uploaded by a client that has since lost its
    // session; drop them rather than leaving them orphaned.
    await removeStorageObjects(images.map((image) => image.storagePath));
    return NOT_AUTHENTICATED;
  }

  const result = await addImages(listingId, user.id, images);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    data: result.data.map((image) => ({
      id: image.id,
      public_url: image.public_url,
      position: image.position,
      is_primary: image.is_primary,
    })),
  };
}

export async function removeImageAction(
  listingId: string,
  imageId: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const result = await removeImage(listingId, user.id, imageId);
  return result.ok ? { ok: true, data: null } : { ok: false, error: result.error };
}

export async function setPrimaryImageAction(
  listingId: string,
  imageId: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const result = await setPrimaryImage(listingId, user.id, imageId);
  return result.ok ? { ok: true, data: null } : { ok: false, error: result.error };
}

export async function reorderImagesAction(
  listingId: string,
  orderedIds: readonly string[]
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (user === null) return NOT_AUTHENTICATED;

  const result = await reorderImages(listingId, user.id, orderedIds);
  return result.ok ? { ok: true, data: null } : { ok: false, error: result.error };
}

/* -------------------------------------------------------------------------- */
/* Publishing                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Publishes a draft. Kept separate from the create action so that an abandoned
 * form leaves a private draft the seller can finish later, rather than a
 * half-finished public listing.
 */
export async function publishListingAction(id: string): Promise<ActionResult> {
  return changeStatusAction(id, 'active');
}
