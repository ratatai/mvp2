/**
 * Canonical values for the RATATAI data contract.
 *
 * These strings are the ONLY representation that is ever written to the
 * database. UI labels live in the translation dictionaries and are never
 * persisted; legacy strings coming from the old lean MVP or from imported data
 * are converted here through explicit, typed mappers.
 *
 * Every mapper returns `null` for an unknown input. Nothing in this file
 * invents a value, substitutes a default, or guesses.
 */

export const LISTING_CATEGORIES = [
  'padangos',
  'ratlankiai',
  'komplektiniai_ratai',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_CONDITIONS = ['new', 'used'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const LISTING_STATUSES = ['draft', 'active', 'sold', 'archived'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const TIRE_SEASONS = ['summer', 'winter', 'all_season'] as const;
export type TireSeason = (typeof TIRE_SEASONS)[number];

export const RIM_MATERIALS = ['alloy', 'steel', 'forged'] as const;
export type RimMaterial = (typeof RIM_MATERIALS)[number];

export const RIM_ORIGINS = ['oem', 'aftermarket', 'replica'] as const;
export type RimOrigin = (typeof RIM_ORIGINS)[number];

export const RIM_REPAIRS = ['straightened', 'welded', 'painted', 'polished'] as const;
export type RimRepair = (typeof RIM_REPAIRS)[number];

export const SALE_UNITS = ['single', 'pair', 'set'] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export const SUPPORTED_CURRENCY = 'EUR' as const;
export const DEFAULT_COUNTRY = 'LT' as const;

/** Statuses a listing may have while still being visible in the public catalog. */
export const PUBLIC_STATUS: ListingStatus = 'active';
export const PUBLIC_MODERATION_STATUS: ModerationStatus = 'approved';

/* -------------------------------------------------------------------------- */
/* Type guards                                                                 */
/* -------------------------------------------------------------------------- */

function isMember<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export const isListingCategory = (v: unknown): v is ListingCategory =>
  isMember(LISTING_CATEGORIES, v);
export const isListingCondition = (v: unknown): v is ListingCondition =>
  isMember(LISTING_CONDITIONS, v);
export const isListingStatus = (v: unknown): v is ListingStatus =>
  isMember(LISTING_STATUSES, v);
export const isModerationStatus = (v: unknown): v is ModerationStatus =>
  isMember(MODERATION_STATUSES, v);
export const isTireSeason = (v: unknown): v is TireSeason =>
  isMember(TIRE_SEASONS, v);
export const isRimMaterial = (v: unknown): v is RimMaterial =>
  isMember(RIM_MATERIALS, v);
export const isListingSort = (v: unknown): v is ListingSort =>
  isMember(LISTING_SORTS, v);

/* -------------------------------------------------------------------------- */
/* Legacy → canonical mappers                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lithuanian UI strings that used to be stored directly in the database, plus
 * the English category names from the very first lean MVP migration.
 */
const LEGACY_SEASONS: Readonly<Record<string, TireSeason>> = {
  vasara: 'summer',
  vasarines: 'summer',
  'žiema': 'winter',
  ziema: 'winter',
  'žiemines': 'winter',
  visasezonis: 'all_season',
  visasezones: 'all_season',
  'all-season': 'all_season',
  allseason: 'all_season',
};

const LEGACY_CONDITIONS: Readonly<Record<string, ListingCondition>> = {
  naujas: 'new',
  naujos: 'new',
  naudotas: 'used',
  naudotos: 'used',
};

const LEGACY_CATEGORIES: Readonly<Record<string, ListingCategory>> = {
  tires: 'padangos',
  wheels: 'ratlankiai',
  sets: 'komplektiniai_ratai',
  // The lean MVP shipped the complete-wheel category as bare `ratai`.
  ratai: 'komplektiniai_ratai',
};

const LEGACY_SPEC_KEYS: Readonly<Record<string, string>> = {
  centerBore: 'cb',
  center_bore: 'cb',
  offset: 'et',
  offset_et: 'et',
  aspectRatio: 'aspect_ratio',
  treadDepth: 'tread_depth',
  loadIndex: 'load_index',
  speedIndex: 'speed_index',
  runFlat: 'run_flat',
  boltCount: 'bolt_count',
  rimWidth: 'rim_width',
  manufacturingYear: 'manufacturing_year',
};

function normalizeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** `vasara` → `summer`. Returns null for anything unrecognised. */
export function mapLegacySeason(value: unknown): TireSeason | null {
  if (isTireSeason(value)) return value;
  const key = normalizeKey(value);
  if (key === null) return null;
  return LEGACY_SEASONS[key] ?? null;
}

/** `naudotas` → `used`. Returns null for anything unrecognised. */
export function mapLegacyCondition(value: unknown): ListingCondition | null {
  if (isListingCondition(value)) return value;
  const key = normalizeKey(value);
  if (key === null) return null;
  return LEGACY_CONDITIONS[key] ?? null;
}

/** `ratai` → `komplektiniai_ratai`. Returns null for anything unrecognised. */
export function mapLegacyCategory(value: unknown): ListingCategory | null {
  if (isListingCategory(value)) return value;
  const key = normalizeKey(value);
  if (key === null) return null;
  return LEGACY_CATEGORIES[key] ?? null;
}

/** `centerBore` → `cb`, `offset` → `et`. Unknown keys are returned unchanged. */
export function mapLegacySpecKey(key: string): string {
  return LEGACY_SPEC_KEYS[key] ?? key;
}

/**
 * Rewrites the keys of a raw specs object to canonical ones.
 * Values are passed through untouched — this function never converts,
 * rounds, defaults or invents a value. Validation happens afterwards.
 */
export function mapLegacySpecKeys(
  specs: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(specs)) {
    const canonicalKey = mapLegacySpecKey(key);

    // `cb` and `centerBore` must never both survive into the stored object.
    if (canonicalKey in result) continue;

    result[canonicalKey] = value;
  }

  return result;
}
