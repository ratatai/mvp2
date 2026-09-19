/**
 * Turns validated specs into label/value pairs for display.
 *
 * A field that the seller did not fill in produces no row at all — the UI
 * never shows a placeholder value, a zero or a guessed default. Labels come
 * from the dictionary; the underlying values stay canonical.
 */

import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { formatMeasure, formatNumber } from '@/lib/format';
import type {
  Listing,
  RimSpecs,
  TireSpecs,
  WheelSpecs,
} from '@/domain/listing.contract';
import { formatRimSize, formatTireSize } from '@/domain/listing.validation';

export interface SpecRow {
  readonly label: string;
  readonly value: string;
}

export interface SpecGroup {
  readonly title: string | null;
  readonly rows: readonly SpecRow[];
}

function row(label: string, value: string | null | undefined): SpecRow | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  return { label, value };
}

function compact(items: readonly (SpecRow | null)[]): readonly SpecRow[] {
  return items.filter((item): item is SpecRow => item !== null);
}

function boolLabel(value: boolean | undefined, dict: Dictionary): string | null {
  if (value === undefined) return null;
  return value ? dict.form.yes : dict.form.no;
}

/* -------------------------------------------------------------------------- */
/* Per-category rows                                                           */
/* -------------------------------------------------------------------------- */

export function tireSpecRows(
  specs: TireSpecs,
  dict: Dictionary,
  locale: Locale
): readonly SpecRow[] {
  const s = dict.specs;

  return compact([
    row(s.brand, specs.brand),
    row(s.model, specs.model),
    row(s.size, formatTireSize(specs)),
    row(s.season, dict.season[specs.season]),
    row(
      s.tread_depth,
      specs.tread_depth === undefined
        ? null
        : formatMeasure(specs.tread_depth, 'mm', locale)
    ),
    row(
      s.manufacturing_year,
      specs.manufacturing_year === undefined
        ? null
        : String(specs.manufacturing_year)
    ),
    row(s.dot, specs.dot),
    row(
      s.load_index,
      specs.load_index === undefined ? null : String(specs.load_index)
    ),
    row(s.speed_index, specs.speed_index),
    row(s.xl, boolLabel(specs.xl, dict)),
    row(s.run_flat, boolLabel(specs.run_flat, dict)),
    row(s.studded, boolLabel(specs.studded, dict)),
    row(
      s.sale_unit,
      specs.sale_unit === undefined ? null : dict.saleUnit[specs.sale_unit]
    ),
    row(s.defects, specs.defects),
  ]);
}

export function rimSpecRows(
  specs: RimSpecs,
  dict: Dictionary,
  locale: Locale
): readonly SpecRow[] {
  const s = dict.specs;

  return compact([
    row(s.brand, specs.brand),
    row(s.model, specs.model),
    row(s.size, formatRimSize(specs)),
    row(s.diameter, `R${specs.diameter}`),
    row(s.rim_width, `${formatNumber(specs.rim_width, locale)}J`),
    row(s.pcd, specs.pcd),
    row(s.bolt_count, String(specs.bolt_count)),
    row(s.cb, formatMeasure(specs.cb, 'mm', locale)),
    row(s.et, `ET${specs.et}`),
    row(s.material, dict.material[specs.material]),
    row(s.oem_code, specs.oem_code),
    row(s.origin, specs.origin === undefined ? null : dict.origin[specs.origin]),
    row(s.color, specs.color),
    row(
      s.repairs,
      specs.repairs === undefined || specs.repairs.length === 0
        ? null
        : specs.repairs.map((item) => dict.repairs[item]).join(', ')
    ),
    row(s.fitment, specs.fitment),
  ]);
}

export function wheelSpecGroups(
  specs: WheelSpecs,
  dict: Dictionary,
  locale: Locale
): readonly SpecGroup[] {
  const rimRows = compact([
    ...rimSpecRows(specs.rim, dict, locale),
    row(
      dict.specs.condition,
      specs.rim.condition === undefined
        ? null
        : dict.condition[specs.rim.condition]
    ),
  ]);

  const tireRows = compact([
    ...tireSpecRows(specs.tire, dict, locale),
    row(
      dict.specs.condition,
      specs.tire.condition === undefined
        ? null
        : dict.condition[specs.tire.condition]
    ),
  ]);

  return [
    { title: dict.specs.rimSection, rows: rimRows },
    { title: dict.specs.tireSection, rows: tireRows },
  ];
}

/** Full, grouped spec list for the listing detail page. */
export function listingSpecGroups(
  listing: Listing,
  dict: Dictionary,
  locale: Locale
): readonly SpecGroup[] {
  switch (listing.category) {
    case 'padangos':
      return [{ title: null, rows: tireSpecRows(listing.specs, dict, locale) }];
    case 'ratlankiai':
      return [{ title: null, rows: rimSpecRows(listing.specs, dict, locale) }];
    case 'komplektiniai_ratai':
      return wheelSpecGroups(listing.specs, dict, locale);
  }
}

/* -------------------------------------------------------------------------- */
/* Card summary                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The three or four values a buyer scans first on a catalog card. Anything the
 * seller left blank is simply absent.
 */
export function listingCardSummary(
  listing: Listing,
  dict: Dictionary
): readonly string[] {
  switch (listing.category) {
    case 'padangos': {
      const specs = listing.specs;
      return compactStrings([
        formatTireSize(specs),
        dict.season[specs.season],
        specs.tread_depth === undefined ? null : `${specs.tread_depth} mm`,
      ]);
    }
    case 'ratlankiai': {
      const specs = listing.specs;
      return compactStrings([
        `R${specs.diameter}`,
        specs.pcd,
        `ET${specs.et}`,
        dict.material[specs.material],
      ]);
    }
    case 'komplektiniai_ratai': {
      const specs = listing.specs;
      return compactStrings([
        formatTireSize(specs.tire),
        specs.rim.pcd,
        dict.season[specs.tire.season],
      ]);
    }
  }
}

function compactStrings(items: readonly (string | null)[]): readonly string[] {
  return items.filter(
    (item): item is string => item !== null && item.trim().length > 0
  );
}

/** Brand shown on the card title line, when the category has one. */
export function listingBrand(listing: Listing): string | null {
  switch (listing.category) {
    case 'padangos':
    case 'ratlankiai':
      return listing.specs.brand;
    case 'komplektiniai_ratai':
      return listing.specs.tire.brand;
  }
}
