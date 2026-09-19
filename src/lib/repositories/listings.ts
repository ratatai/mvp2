import 'server-only';

/**
 * Listing data access.
 *
 * UI components never talk to Supabase directly: they call these functions,
 * which own the query shapes, the filter translation and the error handling.
 *
 * Raw PostgREST errors never leave this module. Callers receive a small,
 * stable result object so that a database message can never be rendered to a
 * visitor.
 */

import type { PostgrestError } from '@supabase/supabase-js';

import type { ListingCategory } from '@/domain/canonical';
import {
  PUBLIC_MODERATION_STATUS,
  PUBLIC_STATUS,
  type ListingStatus,
} from '@/domain/canonical';
import type { CatalogFilters } from '@/domain/filters';
import {
  CATALOG_PAGE_SIZE,
  type Listing,
  type ListingDraft,
  type ListingWithSeller,
  type Paginated,
} from '@/domain/listing.contract';
import { draftToInsert, draftToUpdate, rowToListing, rowToPublicSeller, rowsToListings } from '@/domain/listing.mapper';
import { buildTextSearchExpression, parseTireSizeQuery } from '@/lib/search';
import { buildListingSlug } from '@/lib/slug';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ListingImageRow,
  ListingRow,
} from '@/lib/supabase/database.types';

/* -------------------------------------------------------------------------- */
/* Result types                                                                */
/* -------------------------------------------------------------------------- */

export type RepoError =
  | 'not_found'
  | 'not_authenticated'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'unavailable';

export type RepoResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: RepoError };

/** Converts a PostgREST error into a safe, generic code. */
function toRepoError(error: PostgrestError | null): RepoError {
  if (error === null) return 'unavailable';

  switch (error.code) {
    case 'PGRST116':
      return 'not_found';
    case '23505':
      return 'conflict';
    case '23514':
    case '22P02':
      return 'validation';
    case '42501':
      return 'forbidden';
    default:
      return 'unavailable';
  }
}

/** Server-side only. Never reaches the browser. */
function logRepoIssue(scope: string, detail: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[listings:${scope}]`, detail);
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Builds the client without ever throwing out of this module. Missing or
 * malformed configuration becomes an 'unavailable' result that the UI can
 * translate, instead of an unhandled 500.
 */
async function getClient(): Promise<SupabaseServerClient | null> {
  try {
    return await createSupabaseServerClient();
  } catch (error) {
    logRepoIssue('env', error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Filter translation                                                          */
/* -------------------------------------------------------------------------- */

type SpecField =
  | 'width'
  | 'aspect_ratio'
  | 'diameter'
  | 'season'
  | 'brand'
  | 'tread_depth'
  | 'manufacturing_year'
  | 'rim_width'
  | 'bolt_count'
  | 'pcd'
  | 'cb'
  | 'et'
  | 'material';

const TIRE_FIELDS: ReadonlySet<SpecField> = new Set([
  'width',
  'aspect_ratio',
  'season',
  'tread_depth',
  'manufacturing_year',
]);

const RIM_FIELDS: ReadonlySet<SpecField> = new Set([
  'rim_width',
  'bolt_count',
  'pcd',
  'cb',
  'et',
  'material',
]);

/**
 * Returns the JSON path for a spec field within a category, or null when the
 * field does not exist for that category.
 *
 * Complete wheels nest their data, so the same UI filter resolves to
 * `specs->tire->width` there and to `specs->width` for plain tires.
 */
export function specPath(
  category: ListingCategory,
  field: SpecField,
  asText = false
): string | null {
  const arrow = asText ? '->>' : '->';

  switch (category) {
    case 'padangos':
      if (RIM_FIELDS.has(field)) return null;
      return `specs${arrow}${field}`;

    case 'ratlankiai':
      if (TIRE_FIELDS.has(field)) return null;
      return `specs${arrow}${field}`;

    case 'komplektiniai_ratai':
      if (TIRE_FIELDS.has(field)) return `specs->tire${arrow}${field}`;
      if (RIM_FIELDS.has(field)) return `specs->rim${arrow}${field}`;
      // `diameter` and `brand` exist on both halves; the tire half is the one
      // buyers search by.
      return `specs->tire${arrow}${field}`;
  }
}

const SELECT_WITH_IMAGES =
  '*, listing_images(id, listing_id, storage_path, public_url, position, is_primary, created_at)';

interface RowWithImages extends ListingRow {
  listing_images: ListingImageRow[] | null;
}

function splitRows(rows: readonly RowWithImages[]): {
  rows: ListingRow[];
  images: Map<string, ListingImageRow[]>;
} {
  const plain: ListingRow[] = [];
  const images = new Map<string, ListingImageRow[]>();

  for (const row of rows) {
    const { listing_images, ...rest } = row;
    plain.push(rest);
    images.set(row.id, listing_images ?? []);
  }

  return { rows: plain, images };
}

/* -------------------------------------------------------------------------- */
/* Public catalog                                                              */
/* -------------------------------------------------------------------------- */

export async function fetchPublicListings(
  filters: CatalogFilters
): Promise<RepoResult<Paginated<Listing>>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  let query = supabase
    .from('listings')
    .select(SELECT_WITH_IMAGES, { count: 'exact' })
    .eq('status', PUBLIC_STATUS)
    .eq('moderation_status', PUBLIC_MODERATION_STATUS);

  const { category } = filters;

  if (category !== undefined) {
    query = query.eq('category', category);
  }

  if (filters.condition !== undefined) {
    query = query.eq('condition', filters.condition);
  }

  if (filters.city !== undefined) {
    query = query.ilike('city', `%${filters.city.replace(/[\\%_]/g, '\\$&')}%`);
  }

  if (filters.priceMin !== undefined) query = query.gte('price', filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte('price', filters.priceMax);
  if (filters.quantity !== undefined) query = query.gte('quantity', filters.quantity);

  // Free-text search. A recognised tire size becomes three exact numeric
  // filters instead of a LIKE, which is both faster and far more accurate.
  if (filters.q !== undefined) {
    const size = parseTireSizeQuery(filters.q);
    const sizeCategory = category ?? null;

    if (
      size !== null &&
      (sizeCategory === 'padangos' || sizeCategory === 'komplektiniai_ratai')
    ) {
      const widthPath = specPath(sizeCategory, 'width');
      const aspectPath = specPath(sizeCategory, 'aspect_ratio');
      const diameterPath = specPath(sizeCategory, 'diameter');

      if (widthPath !== null) query = query.filter(widthPath, 'eq', size.width);
      if (aspectPath !== null) {
        query = query.filter(aspectPath, 'eq', size.aspect_ratio);
      }
      if (diameterPath !== null) {
        query = query.filter(diameterPath, 'eq', size.diameter);
      }
    } else {
      query = query.or(buildTextSearchExpression(filters.q));
    }
  }

  // Technical filters only make sense inside a category, and that is also the
  // only place the UI offers them.
  if (category !== undefined) {
    const exact: ReadonlyArray<readonly [SpecField, number | string | undefined]> = [
      ['width', filters.width],
      ['aspect_ratio', filters.aspectRatio],
      ['diameter', filters.diameter],
      ['season', filters.season],
      ['rim_width', filters.rimWidth],
      ['bolt_count', filters.boltCount],
      ['cb', filters.cb],
      ['material', filters.material],
    ];

    for (const [field, value] of exact) {
      if (value === undefined) continue;
      const path = specPath(category, field);
      if (path === null) continue;
      query = query.filter(path, 'eq', typeof value === 'string' ? `"${value}"` : value);
    }

    if (filters.pcd !== undefined) {
      const path = specPath(category, 'pcd');
      if (path !== null) query = query.filter(path, 'eq', `"${filters.pcd}"`);
    }

    if (filters.brand !== undefined) {
      const path = specPath(category, 'brand', true);
      if (path !== null) {
        query = query.ilike(path, `%${filters.brand.replace(/[\\%_]/g, '\\$&')}%`);
      }
    }

    const ranges: ReadonlyArray<
      readonly [SpecField, 'gte' | 'lte', number | undefined]
    > = [
      ['tread_depth', 'gte', filters.treadDepthMin],
      ['manufacturing_year', 'gte', filters.yearMin],
      ['et', 'gte', filters.etMin],
      ['et', 'lte', filters.etMax],
    ];

    for (const [field, op, value] of ranges) {
      if (value === undefined) continue;
      const path = specPath(category, field);
      if (path === null) continue;
      query = query.filter(path, op, value);
    }
  }

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: false });

  const page = Math.max(1, filters.page);
  const from = (page - 1) * CATALOG_PAGE_SIZE;

  const { data, error, count } = await query.range(from, from + CATALOG_PAGE_SIZE - 1);

  if (error !== null) {
    logRepoIssue('fetchPublicListings', error);
    return { ok: false, error: toRepoError(error) };
  }

  const { rows, images } = splitRows((data ?? []) as RowWithImages[]);
  const { listings, rejected } = rowsToListings(rows, images);

  if (rejected.length > 0) logRepoIssue('rejected-rows', rejected);

  const total = count ?? listings.length;

  return {
    ok: true,
    data: {
      items: listings,
      total,
      page,
      pageSize: CATALOG_PAGE_SIZE,
      hasMore: from + CATALOG_PAGE_SIZE < total,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchListingBySlug(
  slug: string
): Promise<RepoResult<ListingWithSeller>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  const { data, error } = await supabase
    .from('listings')
    .select(SELECT_WITH_IMAGES)
    .eq('slug', slug)
    .eq('status', PUBLIC_STATUS)
    .eq('moderation_status', PUBLIC_MODERATION_STATUS)
    .maybeSingle();

  if (error !== null) {
    logRepoIssue('fetchListingBySlug', error);
    return { ok: false, error: toRepoError(error) };
  }

  if (data === null) return { ok: false, error: 'not_found' };

  const row = data as RowWithImages;
  const { listing_images, ...listingRow } = row;
  const mapped = rowToListing(listingRow, listing_images ?? []);

  if (!mapped.ok) {
    logRepoIssue('fetchListingBySlug:mapper', mapped.reason);
    return { ok: false, error: 'not_found' };
  }

  // Seller data comes from the restricted view, which carries no email and no
  // user identifier and hides a phone the seller chose to keep private.
  const { data: sellerRow } = await supabase
    .from('listing_sellers')
    .select('listing_id, display_name, city, phone')
    .eq('listing_id', mapped.listing.id)
    .maybeSingle();

  return {
    ok: true,
    data: {
      listing: mapped.listing,
      seller: rowToPublicSeller(sellerRow ?? null),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Owner scoped                                                                */
/* -------------------------------------------------------------------------- */

export async function fetchOwnerListings(
  userId: string
): Promise<RepoResult<readonly Listing[]>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  const { data, error } = await supabase
    .from('listings')
    .select(SELECT_WITH_IMAGES)
    // Belt and braces: RLS already restricts this, and the query says it too.
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error !== null) {
    logRepoIssue('fetchOwnerListings', error);
    return { ok: false, error: toRepoError(error) };
  }

  const { rows, images } = splitRows((data ?? []) as RowWithImages[]);
  const { listings, rejected } = rowsToListings(rows, images);

  if (rejected.length > 0) logRepoIssue('rejected-owner-rows', rejected);

  return { ok: true, data: listings };
}

export async function fetchOwnedListingById(
  id: string,
  userId: string
): Promise<RepoResult<Listing>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  const { data, error } = await supabase
    .from('listings')
    .select(SELECT_WITH_IMAGES)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error !== null) {
    logRepoIssue('fetchOwnedListingById', error);
    return { ok: false, error: toRepoError(error) };
  }

  if (data === null) return { ok: false, error: 'not_found' };

  const row = data as RowWithImages;
  const { listing_images, ...listingRow } = row;
  const mapped = rowToListing(listingRow, listing_images ?? []);

  if (!mapped.ok) {
    logRepoIssue('fetchOwnedListingById:mapper', mapped.reason);
    return { ok: false, error: 'validation' };
  }

  return { ok: true, data: mapped.listing };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreatedListing {
  readonly id: string;
  readonly slug: string;
}

export async function createListing(
  draft: ListingDraft,
  userId: string,
  status: 'draft' | 'active'
): Promise<RepoResult<CreatedListing>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  // Two attempts is enough: the suffix is random, so a collision is already
  // vanishingly unlikely and a second one is not worth a loop.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const payload = draftToInsert(draft, {
      userId,
      slug: buildListingSlug(draft.title),
      status,
    });

    const { data, error } = await supabase
      .from('listings')
      .insert(payload)
      .select('id, slug')
      .single();

    if (error === null && data !== null) {
      return { ok: true, data: { id: data.id, slug: data.slug } };
    }

    if (error?.code !== '23505') {
      logRepoIssue('createListing', error);
      return { ok: false, error: toRepoError(error) };
    }
  }

  return { ok: false, error: 'conflict' };
}

export async function updateListing(
  id: string,
  userId: string,
  draft: ListingDraft
): Promise<RepoResult<{ readonly slug: string }>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  const { data, error } = await supabase
    .from('listings')
    .update(draftToUpdate(draft))
    .eq('id', id)
    .eq('user_id', userId)
    .select('slug')
    .maybeSingle();

  if (error !== null) {
    logRepoIssue('updateListing', error);
    return { ok: false, error: toRepoError(error) };
  }

  if (data === null) return { ok: false, error: 'not_found' };

  return { ok: true, data: { slug: data.slug } };
}

export async function setListingStatus(
  id: string,
  userId: string,
  status: ListingStatus
): Promise<RepoResult<null>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  const { error, count } = await supabase
    .from('listings')
    .update({ status }, { count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error !== null) {
    logRepoIssue('setListingStatus', error);
    return { ok: false, error: toRepoError(error) };
  }

  if (count === 0) return { ok: false, error: 'not_found' };

  return { ok: true, data: null };
}

export async function deleteListing(
  id: string,
  userId: string
): Promise<RepoResult<readonly string[]>> {
  const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

  // Collect the storage paths before the cascade removes the metadata, so the
  // caller can clean up the bucket and never leave orphaned objects behind.
  const { data: imageRows } = await supabase
    .from('listing_images')
    .select('storage_path')
    .eq('listing_id', id);

  const { error, count } = await supabase
    .from('listings')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error !== null) {
    logRepoIssue('deleteListing', error);
    return { ok: false, error: toRepoError(error) };
  }

  if (count === 0) return { ok: false, error: 'not_found' };

  return {
    ok: true,
    data: (imageRows ?? []).map((row) => row.storage_path),
  };
}

/** Slugs of every public listing, for the sitemap. */
export async function fetchPublicSlugs(): Promise<
  readonly { slug: string; updated_at: string }[]
> {
  try {
    const supabase = await getClient();
  if (supabase === null) return { ok: false, error: 'unavailable' };

    const { data, error } = await supabase
      .from('listings')
      .select('slug, updated_at')
      .eq('status', PUBLIC_STATUS)
      .eq('moderation_status', PUBLIC_MODERATION_STATUS)
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (error !== null) return [];

    return data ?? [];
  } catch {
    return [];
  }
}
