import type { ListingCategory } from '@/domain/canonical';
import type { CatalogFilters } from '@/domain/filters';

/**
 * Which filter fields a category panel shows, and in what order.
 *
 * Technical parameters come first (`primary`), split into labelled groups.
 * Everything else — free text, price, city and the less decisive specs — is
 * in `secondary`, which the panel renders inside an expandable section. Every
 * key is a canonical query key read by `parseFilters`; this module only
 * decides layout, never matching.
 */
export type FilterFieldKey = keyof Omit<CatalogFilters, 'category' | 'sort' | 'page'>;

export type FilterGroupId = 'tire' | 'rim' | 'wheelTire' | 'wheelRim';

export interface FilterGroup {
  readonly id: FilterGroupId;
  readonly fields: readonly FilterFieldKey[];
}

export interface FilterLayout {
  readonly primary: readonly FilterGroup[];
  readonly secondary: readonly FilterFieldKey[];
}

/** Filters every listing has, regardless of category. */
export const COMMON_FIELDS = [
  'q',
  'condition',
  'city',
  'priceMin',
  'priceMax',
  'quantity',
] as const satisfies readonly FilterFieldKey[];

const TIRE_LAYOUT: FilterLayout = {
  primary: [{ id: 'tire', fields: ['width', 'aspectRatio', 'diameter'] }],
  secondary: ['season', 'brand', 'treadDepthMin', 'yearMin', ...COMMON_FIELDS],
};

const RIM_LAYOUT: FilterLayout = {
  primary: [{ id: 'rim', fields: ['pcd', 'cb', 'diameter', 'etMin', 'etMax'] }],
  secondary: ['rimWidth', 'boltCount', 'material', 'brand', ...COMMON_FIELDS],
};

// A complete wheel's tyre and rim share one diameter (the canonical contract
// requires them to be equal), so `diameter` appears once, in the tyre group.
const WHEEL_LAYOUT: FilterLayout = {
  primary: [
    { id: 'wheelTire', fields: ['width', 'aspectRatio', 'diameter'] },
    { id: 'wheelRim', fields: ['pcd', 'cb', 'etMin', 'etMax', 'rimWidth', 'boltCount'] },
  ],
  secondary: ['season', ...COMMON_FIELDS],
};

const NO_CATEGORY_LAYOUT: FilterLayout = { primary: [], secondary: COMMON_FIELDS };

export function filterLayout(category: ListingCategory | undefined): FilterLayout {
  switch (category) {
    case 'padangos':
      return TIRE_LAYOUT;
    case 'ratlankiai':
      return RIM_LAYOUT;
    case 'komplektiniai_ratai':
      return WHEEL_LAYOUT;
    default:
      return NO_CATEGORY_LAYOUT;
  }
}

/** True when a filter in the collapsed section is set, so it should start open. */
export function hasActiveSecondary(layout: FilterLayout, filters: CatalogFilters): boolean {
  return layout.secondary.some((key) => filters[key] !== undefined);
}
