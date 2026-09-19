/**
 * Domain shapes for the RATATAI marketplace.
 *
 * These types describe the application's view of a listing — not the database
 * row shape (see src/lib/supabase/database.types.ts) and not the UI form shape.
 * Mapping between the three happens in listing.mapper.ts.
 *
 * Optional fields are genuinely optional: a missing technical value stays
 * missing. Nothing in the contract has a fallback that would let the UI show
 * an invented specification.
 */

import type {
  ListingCategory,
  ListingCondition,
  ListingStatus,
  ModerationStatus,
  RimMaterial,
  RimOrigin,
  RimRepair,
  SaleUnit,
  TireSeason,
} from './canonical';

/* -------------------------------------------------------------------------- */
/* Category-specific technical specs                                           */
/* -------------------------------------------------------------------------- */

/**
 * Tires. The size is always stored as three separate numbers; the printed
 * form `205/55 R16` is derived from them and never persisted as the source of
 * truth.
 */
export interface TireSpecs {
  readonly brand: string;
  readonly model?: string;
  /** Section width in mm, e.g. 205. */
  readonly width: number;
  /** Aspect ratio (profile height) in %, e.g. 55. */
  readonly aspect_ratio: number;
  /** Rim diameter in inches, e.g. 16. */
  readonly diameter: number;
  readonly season: TireSeason;
  /** Remaining tread in mm. */
  readonly tread_depth?: number;
  readonly manufacturing_year?: number;
  /** Raw DOT code as printed on the sidewall. */
  readonly dot?: string;
  readonly load_index?: number;
  readonly speed_index?: string;
  readonly xl?: boolean;
  readonly run_flat?: boolean;
  readonly studded?: boolean;
  /** Free-text description of damage or repairs. */
  readonly defects?: string;
  readonly sale_unit?: SaleUnit;
}

/** Rims / wheel discs. */
export interface RimSpecs {
  readonly brand: string;
  readonly model?: string;
  /** Diameter in inches, e.g. 17. */
  readonly diameter: number;
  /** Rim width in inches (the "J" number), e.g. 8.5. */
  readonly rim_width: number;
  readonly bolt_count: number;
  /** Canonical PCD string, e.g. `5x114.3`. Must agree with bolt_count. */
  readonly pcd: string;
  /** Centre bore in mm, e.g. 66.6. Never stored as `centerBore`. */
  readonly cb: number;
  /** Offset in mm, e.g. 35. Never stored as `offset`. */
  readonly et: number;
  readonly material: RimMaterial;
  readonly oem_code?: string;
  readonly origin?: RimOrigin;
  /** Free-text list of compatible cars, as typed by the seller. */
  readonly fitment?: string;
  readonly color?: string;
  readonly repairs?: readonly RimRepair[];
}

/**
 * Complete wheels: rims with tires already mounted. The two halves keep their
 * own condition, because a set of used rims may carry brand new tires.
 */
export interface WheelSpecs {
  readonly rim: RimSpecs & { readonly condition?: ListingCondition };
  readonly tire: TireSpecs & { readonly condition?: ListingCondition };
}

export type ListingSpecs = TireSpecs | RimSpecs | WheelSpecs;

/** Maps a category to the exact specs shape it is allowed to carry. */
export interface SpecsByCategory {
  readonly padangos: TireSpecs;
  readonly ratlankiai: RimSpecs;
  readonly komplektiniai_ratai: WheelSpecs;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

export interface ListingImage {
  readonly id: string;
  readonly storage_path: string;
  readonly public_url: string;
  readonly position: number;
  readonly is_primary: boolean;
}

/* -------------------------------------------------------------------------- */
/* Seller                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everything a public visitor is allowed to learn about a seller.
 * Deliberately carries no id and no email.
 */
export interface PublicSeller {
  readonly display_name: string | null;
  readonly city: string | null;
  /** Null when the seller kept the number private or never supplied one. */
  readonly phone: string | null;
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

interface ListingBase {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly condition: ListingCondition;
  readonly price: number;
  readonly currency: 'EUR';
  readonly quantity: number;
  readonly country: string;
  readonly city: string;
  readonly area: string | null;
  readonly status: ListingStatus;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly published_at: string | null;
  readonly images: readonly ListingImage[];
}

/**
 * A listing, discriminated by category so that `listing.specs` is correctly
 * narrowed everywhere without a cast.
 */
export type Listing =
  | (ListingBase & { readonly category: 'padangos'; readonly specs: TireSpecs })
  | (ListingBase & { readonly category: 'ratlankiai'; readonly specs: RimSpecs })
  | (ListingBase & {
      readonly category: 'komplektiniai_ratai';
      readonly specs: WheelSpecs;
    });

/** A listing plus the seller data that may be shown publicly. */
export interface ListingWithSeller {
  readonly listing: Listing;
  readonly seller: PublicSeller;
}

/** Summary shape used by catalog cards — no description, no seller. */
export type ListingCard = Omit<Listing, 'description'>;

/* -------------------------------------------------------------------------- */
/* Write models                                                                */
/* -------------------------------------------------------------------------- */

/** What the create form produces, before it becomes a database payload. */
export interface ListingDraft<C extends ListingCategory = ListingCategory> {
  readonly category: C;
  readonly title: string;
  readonly description: string;
  readonly condition: ListingCondition;
  readonly price: number;
  readonly quantity: number;
  readonly city: string;
  readonly area?: string;
  readonly specs: C extends keyof SpecsByCategory ? SpecsByCategory[C] : never;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export const CATALOG_PAGE_SIZE = 24;
export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
