/**
 * Catalog filters and their URL representation.
 *
 * The URL is the single source of truth for filter state: every filter round
 * trips through the query string, so a page refresh keeps the selection and
 * browser Back/Forward move between filter states naturally.
 */

import {
  isListingCategory,
  isListingCondition,
  isListingSort,
  isRimMaterial,
  isTireSeason,
  type ListingCategory,
  type ListingCondition,
  type ListingSort,
  type RimMaterial,
  type TireSeason,
} from './canonical';
import { parsePcd } from './listing.validation';

export interface CatalogFilters {
  readonly category?: ListingCategory;
  readonly q?: string;
  readonly condition?: ListingCondition;
  readonly city?: string;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly quantity?: number;

  /* tires and the tire half of complete wheels */
  readonly width?: number;
  readonly aspectRatio?: number;
  readonly diameter?: number;
  readonly season?: TireSeason;
  readonly brand?: string;
  readonly treadDepthMin?: number;
  readonly yearMin?: number;

  /* rims and the rim half of complete wheels */
  readonly rimWidth?: number;
  readonly boltCount?: number;
  readonly pcd?: string;
  readonly cb?: number;
  readonly etMin?: number;
  readonly etMax?: number;
  readonly material?: RimMaterial;

  readonly sort: ListingSort;
  readonly page: number;
}

export const DEFAULT_FILTERS: CatalogFilters = { sort: 'newest', page: 1 };

/** Query-string keys, in the fixed order used when serializing. */
const KEY_ORDER = [
  'category',
  'q',
  'condition',
  'city',
  'priceMin',
  'priceMax',
  'quantity',
  'width',
  'aspectRatio',
  'diameter',
  'season',
  'brand',
  'treadDepthMin',
  'yearMin',
  'rimWidth',
  'boltCount',
  'pcd',
  'cb',
  'etMin',
  'etMax',
  'material',
  'sort',
  'page',
] as const;

export type FilterKey = (typeof KEY_ORDER)[number];

/** Accepts both a URLSearchParams and the plain object Next.js hands to pages. */
export type RawSearchParams =
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;

function readParam(params: RawSearchParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }

  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

function toInt(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

function toDecimal(
  value: string | undefined,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

function toText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Parses filters out of a query string. Unknown, malformed or out-of-range
 * values are dropped rather than rejected, so a hand-edited URL degrades to a
 * wider search instead of an error page.
 */
export function parseFilters(params: RawSearchParams): CatalogFilters {
  const rawCategory = readParam(params, 'category');
  const rawCondition = readParam(params, 'condition');
  const rawSeason = readParam(params, 'season');
  const rawMaterial = readParam(params, 'material');
  const rawSort = readParam(params, 'sort');
  const rawPcd = toText(readParam(params, 'pcd'), 16);

  const priceMin = toDecimal(readParam(params, 'priceMin'), 0, 1_000_000);
  const priceMax = toDecimal(readParam(params, 'priceMax'), 0, 1_000_000);
  const etMin = toInt(readParam(params, 'etMin'), -60, 90);
  const etMax = toInt(readParam(params, 'etMax'), -60, 90);

  const filters: Record<string, unknown> = {
    sort: isListingSort(rawSort) ? rawSort : 'newest',
    page: toInt(readParam(params, 'page'), 1, 1000) ?? 1,
  };

  if (isListingCategory(rawCategory)) filters['category'] = rawCategory;
  if (isListingCondition(rawCondition)) filters['condition'] = rawCondition;
  if (isTireSeason(rawSeason)) filters['season'] = rawSeason;
  if (isRimMaterial(rawMaterial)) filters['material'] = rawMaterial;

  const q = toText(readParam(params, 'q'), 120);
  if (q !== undefined) filters['q'] = q;

  const city = toText(readParam(params, 'city'), 80);
  if (city !== undefined) filters['city'] = city;

  const brand = toText(readParam(params, 'brand'), 60);
  if (brand !== undefined) filters['brand'] = brand;

  if (rawPcd !== undefined && parsePcd(rawPcd) !== null) filters['pcd'] = rawPcd;

  // Swapped bounds are normalized rather than ignored.
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    filters['priceMin'] = priceMax;
    filters['priceMax'] = priceMin;
  } else {
    if (priceMin !== undefined) filters['priceMin'] = priceMin;
    if (priceMax !== undefined) filters['priceMax'] = priceMax;
  }

  if (etMin !== undefined && etMax !== undefined && etMin > etMax) {
    filters['etMin'] = etMax;
    filters['etMax'] = etMin;
  } else {
    if (etMin !== undefined) filters['etMin'] = etMin;
    if (etMax !== undefined) filters['etMax'] = etMax;
  }

  const numeric: ReadonlyArray<readonly [FilterKey, number, number, boolean]> = [
    ['quantity', 1, 100, true],
    ['width', 105, 405, true],
    ['aspectRatio', 20, 95, true],
    ['diameter', 10, 30, true],
    ['treadDepthMin', 0, 20, false],
    ['yearMin', 1980, 2100, true],
    ['rimWidth', 3, 16, false],
    ['boltCount', 3, 10, true],
    ['cb', 40, 130, false],
  ];

  for (const [key, min, max, isInteger] of numeric) {
    const raw = readParam(params, key);
    const value = isInteger ? toInt(raw, min, max) : toDecimal(raw, min, max);
    if (value !== undefined) filters[key] = value;
  }

  return filters as unknown as CatalogFilters;
}

/**
 * Serializes filters back into a query string. Default values are omitted so
 * that the canonical catalog URL stays clean and stable for SEO.
 */
export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  const source = filters as unknown as Record<string, unknown>;

  for (const key of KEY_ORDER) {
    const value = source[key];

    if (value === undefined || value === null || value === '') continue;
    if (key === 'sort' && value === 'newest') continue;
    if (key === 'page' && value === 1) continue;

    params.set(key, String(value));
  }

  return params;
}

/** `?width=205&season=winter`, or an empty string when nothing is selected. */
export function filtersToQueryString(filters: CatalogFilters): string {
  const params = filtersToSearchParams(filters);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

/** True when nothing but the defaults is selected. */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  const params = filtersToSearchParams(filters);
  params.delete('page');
  params.delete('category');
  return Array.from(params.keys()).length > 0;
}

/** Returns a copy with one filter changed and pagination reset. */
export function withFilter<K extends keyof CatalogFilters>(
  filters: CatalogFilters,
  key: K,
  value: CatalogFilters[K] | undefined
): CatalogFilters {
  const next: Record<string, unknown> = { ...filters };

  if (value === undefined || value === '') {
    delete next[key as string];
  } else {
    next[key as string] = value;
  }

  next['page'] = 1;
  return next as unknown as CatalogFilters;
}

/** Drops every filter except the category tab. */
export function clearFilters(filters: CatalogFilters): CatalogFilters {
  return filters.category === undefined
    ? { ...DEFAULT_FILTERS }
    : { ...DEFAULT_FILTERS, category: filters.category };
}
