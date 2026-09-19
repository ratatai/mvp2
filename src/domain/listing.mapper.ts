/**
 * Mapping between database rows and domain objects.
 *
 * The mapper is the only place allowed to cross between the two worlds, and it
 * is deliberately conservative:
 *
 *   • a row whose `specs` does not satisfy its category is rejected, not
 *     repaired — the catalog simply skips it rather than rendering invented
 *     specifications;
 *   • nothing is defaulted. A missing optional value stays missing;
 *   • legacy keys and legacy enum strings are converted through the explicit
 *     mappers in canonical.ts before validation.
 */

import {
  isListingCondition,
  isListingStatus,
  isModerationStatus,
  mapLegacyCategory,
  mapLegacyCondition,
  mapLegacySpecKeys,
  SUPPORTED_CURRENCY,
  type ListingCategory,
} from './canonical';
import type {
  Listing,
  ListingDraft,
  ListingImage,
  PublicSeller,
} from './listing.contract';
import { parseSpecsForCategory } from './listing.validation';
import type {
  ListingImageRow,
  ListingInsert,
  ListingRow,
  ListingSellerRow,
  ListingUpdate,
} from '@/lib/supabase/database.types';

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

/** Primary image first, then by ascending position. */
export function sortImages(
  images: readonly ListingImage[]
): readonly ListingImage[] {
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.position - b.position;
  });
}

export function rowToImage(row: ListingImageRow): ListingImage {
  return {
    id: row.id,
    storage_path: row.storage_path,
    public_url: row.public_url,
    position: row.position,
    is_primary: row.is_primary,
  };
}

/**
 * The image a card should show. Falls back to the first real photo when no
 * image is flagged primary — never to a fabricated placeholder URL. Returns
 * null when the listing genuinely has no photos, so the UI can render a
 * localized "no image" state.
 */
export function primaryImageOf(
  images: readonly ListingImage[]
): ListingImage | null {
  const sorted = sortImages(images);
  return sorted[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Row → domain                                                                */
/* -------------------------------------------------------------------------- */

export type RowMapResult =
  | { readonly ok: true; readonly listing: Listing }
  | { readonly ok: false; readonly reason: string };

function normalizeSpecs(specs: unknown): Record<string, unknown> | null {
  if (typeof specs !== 'object' || specs === null || Array.isArray(specs)) {
    return null;
  }

  const record = specs as Record<string, unknown>;

  // Complete wheels nest two objects; rewrite legacy keys inside each half.
  if ('rim' in record || 'tire' in record) {
    const rim = record['rim'];
    const tire = record['tire'];

    return {
      ...mapLegacySpecKeys(record),
      ...(typeof rim === 'object' && rim !== null && !Array.isArray(rim)
        ? { rim: mapLegacySpecKeys(rim as Record<string, unknown>) }
        : {}),
      ...(typeof tire === 'object' && tire !== null && !Array.isArray(tire)
        ? { tire: mapLegacySpecKeys(tire as Record<string, unknown>) }
        : {}),
    };
  }

  return mapLegacySpecKeys(record);
}

/**
 * Converts a database row plus its images into a domain listing.
 * Never throws — an unrecognised category, an invalid status or a specs blob
 * that does not match its category comes back as `{ ok: false }`.
 */
export function rowToListing(
  row: ListingRow,
  imageRows: readonly ListingImageRow[] = []
): RowMapResult {
  const category: ListingCategory | null = mapLegacyCategory(row.category);
  if (category === null) {
    return { ok: false, reason: `unknown_category:${row.category}` };
  }

  const condition = isListingCondition(row.condition)
    ? row.condition
    : mapLegacyCondition(row.condition);
  if (condition === null) {
    return { ok: false, reason: `unknown_condition:${row.condition}` };
  }

  if (!isListingStatus(row.status)) {
    return { ok: false, reason: `unknown_status:${row.status}` };
  }

  if (!isModerationStatus(row.moderation_status)) {
    return { ok: false, reason: `unknown_moderation_status:${row.moderation_status}` };
  }

  if (row.currency !== SUPPORTED_CURRENCY) {
    return { ok: false, reason: `unsupported_currency:${row.currency}` };
  }

  const normalized = normalizeSpecs(row.specs);
  if (normalized === null) {
    return { ok: false, reason: 'specs_not_an_object' };
  }

  const parsed = parseSpecsForCategory(category, normalized);
  if (!parsed.ok) {
    return { ok: false, reason: `invalid_specs:${parsed.issues.join('|')}` };
  }

  const images = sortImages(imageRows.map(rowToImage));

  const base = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    condition,
    price: Number(row.price),
    currency: SUPPORTED_CURRENCY,
    quantity: row.quantity,
    country: row.country,
    city: row.city,
    area: row.area,
    status: row.status,
    moderation_status: row.moderation_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    images,
  } as const;

  switch (parsed.category) {
    case 'padangos':
      return { ok: true, listing: { ...base, category: 'padangos', specs: parsed.specs } };
    case 'ratlankiai':
      return { ok: true, listing: { ...base, category: 'ratlankiai', specs: parsed.specs } };
    case 'komplektiniai_ratai':
      return {
        ok: true,
        listing: { ...base, category: 'komplektiniai_ratai', specs: parsed.specs },
      };
  }
}

/**
 * Maps a page of rows, silently dropping the ones that fail validation so a
 * single corrupt row cannot break the whole catalog. The rejected reasons are
 * returned for logging rather than shown to the visitor.
 */
export function rowsToListings(
  rows: readonly ListingRow[],
  imagesByListing: ReadonlyMap<string, readonly ListingImageRow[]>
): { readonly listings: readonly Listing[]; readonly rejected: readonly string[] } {
  const listings: Listing[] = [];
  const rejected: string[] = [];

  for (const row of rows) {
    const result = rowToListing(row, imagesByListing.get(row.id) ?? []);
    if (result.ok) {
      listings.push(result.listing);
    } else {
      rejected.push(`${row.id}:${result.reason}`);
    }
  }

  return { listings, rejected };
}

/* -------------------------------------------------------------------------- */
/* Seller                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Builds the public seller object. The view already hides a private phone and
 * never selects the email or the auth identifier; this function additionally
 * guarantees that no extra key can leak through by constructing a fresh object.
 */
export function rowToPublicSeller(row: ListingSellerRow | null): PublicSeller {
  return {
    display_name: row?.display_name ?? null,
    city: row?.city ?? null,
    phone: row?.phone ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Domain → database                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Builds an insert payload. `user_id` always comes from the authenticated
 * session, never from the form, and `status` is chosen by the caller so the
 * same function serves both "save as draft" and "publish".
 */
export function draftToInsert(
  draft: ListingDraft,
  params: {
    readonly userId: string;
    readonly slug: string;
    readonly status: 'draft' | 'active';
  }
): ListingInsert {
  return {
    user_id: params.userId,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    condition: draft.condition,
    price: draft.price,
    currency: SUPPORTED_CURRENCY,
    quantity: draft.quantity,
    city: draft.city,
    area: draft.area ?? null,
    specs: draft.specs as unknown as ListingInsert['specs'],
    status: params.status,
    slug: params.slug,
  };
}

/** Builds an update payload. Never touches user_id, slug or moderation_status. */
export function draftToUpdate(draft: ListingDraft): ListingUpdate {
  return {
    category: draft.category,
    title: draft.title,
    description: draft.description,
    condition: draft.condition,
    price: draft.price,
    quantity: draft.quantity,
    city: draft.city,
    area: draft.area ?? null,
    specs: draft.specs as unknown as ListingUpdate['specs'],
  };
}
