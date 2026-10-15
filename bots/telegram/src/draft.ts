/**
 * The bot's working copy of a tyre listing.
 *
 * Every field is optional while the conversation is running: a value is only
 * present once it was read from the photos with certainty, confirmed by the
 * seller, or typed by the seller. Nothing here has a default — the same rule
 * the site's data contract follows.
 */

import type { ListingCondition, SaleUnit, TireSeason } from '../../../src/domain/canonical';

export interface TyreDraft {
  brand?: string;
  model?: string;
  width?: number;
  aspect_ratio?: number;
  diameter?: number;
  season?: TireSeason;
  tread_depth?: number;
  manufacturing_year?: number;
  dot?: string;
  load_index?: number;
  speed_index?: string;
  xl?: boolean;
  run_flat?: boolean;
  studded?: boolean;
  defects?: string;
  sale_unit?: SaleUnit;
  condition?: ListingCondition;
  quantity?: number;
  price?: number;
  city?: string;
}

export type DraftKey = keyof TyreDraft;

export const DRAFT_KEYS: readonly DraftKey[] = [
  'brand',
  'model',
  'width',
  'aspect_ratio',
  'diameter',
  'season',
  'tread_depth',
  'manufacturing_year',
  'dot',
  'load_index',
  'speed_index',
  'xl',
  'run_flat',
  'studded',
  'defects',
  'sale_unit',
  'condition',
  'quantity',
  'price',
  'city',
];

/** Merges a patch, ignoring keys whose value is undefined. */
export function applyPatch(draft: TyreDraft, patch: Partial<TyreDraft>): TyreDraft {
  const next: Record<string, unknown> = { ...draft };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next as TyreDraft;
}

/** Removes keys from a draft (used when the seller wants to re-enter a value). */
export function clearKeys(draft: TyreDraft, keys: readonly DraftKey[]): TyreDraft {
  const next: Record<string, unknown> = { ...draft };
  for (const key of keys) delete next[key];
  return next as TyreDraft;
}
