/**
 * Declarative description of the create/edit form.
 *
 * The form is generated from these descriptors, so a new spec field is one
 * entry here plus one dictionary key — the JSX never has to change. Nested
 * names ("rim.brand") build the nested specs object for complete wheels.
 *
 * Conversion rules are strict about absence: an empty input produces no key at
 * all, so an unfilled optional field stays unfilled instead of becoming 0,
 * false, the current year or an empty string.
 */

import {
  RIM_MATERIALS,
  RIM_ORIGINS,
  RIM_REPAIRS,
  SALE_UNITS,
  TIRE_SEASONS,
  type ListingCategory,
} from '@/domain/canonical';
import type { Dictionary } from '@/i18n';

export type FieldKind =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'textarea'
  | 'checkboxes';

export interface FieldSpec {
  /** Dotted path inside the specs object, e.g. `width` or `rim.brand`. */
  readonly name: string;
  readonly kind: FieldKind;
  /** Key inside dict.specs used as the label. */
  readonly labelKey: keyof Dictionary['specs'];
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly placeholder?: string;
  /** Option values for select/checkboxes; labels come from the dictionary. */
  readonly options?: readonly string[];
  /** Which dictionary section holds the option labels. */
  readonly optionDict?: 'season' | 'material' | 'origin' | 'repairs' | 'saleUnit' | 'condition';
}

export interface FieldGroup {
  /** Dictionary key for the group heading, or null for an unlabelled group. */
  readonly titleKey: keyof Dictionary['specs'] | null;
  readonly fields: readonly FieldSpec[];
}

/* -------------------------------------------------------------------------- */
/* Field definitions                                                           */
/* -------------------------------------------------------------------------- */

function tireFields(prefix = ''): readonly FieldSpec[] {
  const p = (name: string) => `${prefix}${name}`;

  return [
    { name: p('brand'), kind: 'text', labelKey: 'brand', required: true, placeholder: 'Michelin' },
    { name: p('model'), kind: 'text', labelKey: 'model', placeholder: 'Primacy 4' },
    { name: p('width'), kind: 'number', labelKey: 'width', required: true, min: 105, max: 405, placeholder: '205' },
    { name: p('aspect_ratio'), kind: 'number', labelKey: 'aspect_ratio', required: true, min: 20, max: 95, placeholder: '55' },
    { name: p('diameter'), kind: 'number', labelKey: 'diameter', required: true, min: 10, max: 26, placeholder: '16' },
    {
      name: p('season'),
      kind: 'select',
      labelKey: 'season',
      required: true,
      options: TIRE_SEASONS,
      optionDict: 'season',
    },
    { name: p('tread_depth'), kind: 'number', labelKey: 'tread_depth', min: 0, max: 20, step: 0.5, placeholder: '7.5' },
    { name: p('manufacturing_year'), kind: 'number', labelKey: 'manufacturing_year', min: 1980, max: 2100, placeholder: '2021' },
    { name: p('dot'), kind: 'text', labelKey: 'dot', placeholder: '3021' },
    { name: p('load_index'), kind: 'number', labelKey: 'load_index', min: 20, max: 130, placeholder: '91' },
    { name: p('speed_index'), kind: 'text', labelKey: 'speed_index', placeholder: 'V' },
    { name: p('xl'), kind: 'boolean', labelKey: 'xl' },
    { name: p('run_flat'), kind: 'boolean', labelKey: 'run_flat' },
    { name: p('studded'), kind: 'boolean', labelKey: 'studded' },
    {
      name: p('sale_unit'),
      kind: 'select',
      labelKey: 'sale_unit',
      options: SALE_UNITS,
      optionDict: 'saleUnit',
    },
    { name: p('defects'), kind: 'textarea', labelKey: 'defects' },
  ];
}

function rimFields(prefix = ''): readonly FieldSpec[] {
  const p = (name: string) => `${prefix}${name}`;

  return [
    { name: p('brand'), kind: 'text', labelKey: 'brand', required: true, placeholder: 'BBS' },
    { name: p('model'), kind: 'text', labelKey: 'model', placeholder: 'CH-R' },
    { name: p('diameter'), kind: 'number', labelKey: 'diameter', required: true, min: 10, max: 30, placeholder: '18' },
    { name: p('rim_width'), kind: 'number', labelKey: 'rim_width', required: true, min: 3, max: 16, step: 0.5, placeholder: '8.5' },
    { name: p('bolt_count'), kind: 'number', labelKey: 'bolt_count', required: true, min: 3, max: 10, placeholder: '5' },
    { name: p('pcd'), kind: 'text', labelKey: 'pcd', required: true, placeholder: '5x112' },
    { name: p('cb'), kind: 'number', labelKey: 'cb', required: true, min: 40, max: 130, step: 0.1, placeholder: '66.6' },
    { name: p('et'), kind: 'number', labelKey: 'et', required: true, min: -60, max: 90, placeholder: '35' },
    {
      name: p('material'),
      kind: 'select',
      labelKey: 'material',
      required: true,
      options: RIM_MATERIALS,
      optionDict: 'material',
    },
    { name: p('oem_code'), kind: 'text', labelKey: 'oem_code' },
    {
      name: p('origin'),
      kind: 'select',
      labelKey: 'origin',
      options: RIM_ORIGINS,
      optionDict: 'origin',
    },
    { name: p('color'), kind: 'text', labelKey: 'color' },
    {
      name: p('repairs'),
      kind: 'checkboxes',
      labelKey: 'repairs',
      options: RIM_REPAIRS,
      optionDict: 'repairs',
    },
    { name: p('fitment'), kind: 'textarea', labelKey: 'fitment' },
  ];
}

const CONDITION_OPTIONS = ['new', 'used'] as const;

export const FIELD_GROUPS: Readonly<Record<ListingCategory, readonly FieldGroup[]>> = {
  padangos: [{ titleKey: null, fields: tireFields() }],
  ratlankiai: [{ titleKey: null, fields: rimFields() }],
  komplektiniai_ratai: [
    {
      titleKey: 'rimSection',
      fields: [
        ...rimFields('rim.'),
        {
          name: 'rim.condition',
          kind: 'select',
          labelKey: 'condition',
          options: CONDITION_OPTIONS,
          optionDict: 'condition',
        },
      ],
    },
    {
      titleKey: 'tireSection',
      fields: [
        ...tireFields('tire.'),
        {
          name: 'tire.condition',
          kind: 'select',
          labelKey: 'condition',
          options: CONDITION_OPTIONS,
          optionDict: 'condition',
        },
      ],
    },
  ],
};

/** Every spec field name for a category, in render order. */
export function specFieldNames(category: ListingCategory): readonly string[] {
  return FIELD_GROUPS[category].flatMap((group) =>
    group.fields.map((field) => field.name)
  );
}

export function findField(
  category: ListingCategory,
  name: string
): FieldSpec | undefined {
  for (const group of FIELD_GROUPS[category]) {
    const match = group.fields.find((field) => field.name === name);
    if (match !== undefined) return match;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Form values                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Raw form state. Text and number inputs hold strings, booleans hold
 * 'true' | 'false' | '', checkbox groups hold a comma-separated list.
 */
export type FormValues = Record<string, string>;

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (key === undefined) return;

    const existing = cursor[key];
    if (typeof existing !== 'object' || existing === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  if (last !== undefined) cursor[last] = value;
}

/**
 * Builds the specs object from raw form values.
 * Empty inputs contribute nothing, so absence survives the round trip.
 */
export function buildSpecs(
  category: ListingCategory,
  values: FormValues
): Record<string, unknown> {
  const specs: Record<string, unknown> = {};

  for (const group of FIELD_GROUPS[category]) {
    for (const field of group.fields) {
      const raw = values[field.name]?.trim() ?? '';

      if (raw.length === 0) continue;

      switch (field.kind) {
        case 'number': {
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) continue;
          setPath(specs, field.name, parsed);
          break;
        }
        case 'boolean': {
          if (raw !== 'true' && raw !== 'false') continue;
          setPath(specs, field.name, raw === 'true');
          break;
        }
        case 'checkboxes': {
          const items = raw
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
          if (items.length === 0) continue;
          setPath(specs, field.name, items);
          break;
        }
        default:
          setPath(specs, field.name, raw);
      }
    }
  }

  return specs;
}

export interface CoreValues {
  readonly title: string;
  readonly description: string;
  readonly condition: string;
  readonly price: string;
  readonly quantity: string;
  readonly city: string;
  readonly area: string;
}

/** Assembles the payload that the validation schema expects. */
export function buildDraftInput(
  category: ListingCategory,
  values: FormValues
): Record<string, unknown> {
  const price = Number(values['price'] ?? '');
  const quantity = Number(values['quantity'] ?? '');
  const area = values['area']?.trim() ?? '';

  return {
    category,
    title: values['title'] ?? '',
    description: values['description'] ?? '',
    condition: values['condition'] ?? '',
    price: Number.isFinite(price) ? price : Number.NaN,
    quantity: Number.isFinite(quantity) ? quantity : Number.NaN,
    city: values['city'] ?? '',
    ...(area.length > 0 ? { area } : {}),
    specs: buildSpecs(category, values),
  };
}

/* -------------------------------------------------------------------------- */
/* Issues → field errors                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Maps validation issues ("specs.width: too_small") onto form field names so
 * each message can be rendered next to the input it belongs to.
 */
export function issuesToFieldErrors(
  issues: readonly string[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const separator = issue.indexOf(':');
    const path = separator === -1 ? '' : issue.slice(0, separator).trim();
    const message = separator === -1 ? issue : issue.slice(separator + 1).trim();

    const field = path.startsWith('specs.')
      ? path.slice('specs.'.length)
      : path;

    const key = field.length > 0 ? field : '_form';
    if (errors[key] === undefined) errors[key] = message;
  }

  return errors;
}

/** Turns a validated draft back into form values, for the edit form. */
export function draftToFormValues(listing: {
  title: string;
  description: string;
  condition: string;
  price: number;
  quantity: number;
  city: string;
  area: string | null;
  specs: unknown;
}): FormValues {
  const values: FormValues = {
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    price: String(listing.price),
    quantity: String(listing.quantity),
    city: listing.city,
    area: listing.area ?? '',
  };

  const flatten = (input: unknown, prefix: string): void => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return;

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const name = `${prefix}${key}`;

      if (Array.isArray(value)) {
        values[name] = value.join(',');
      } else if (typeof value === 'object' && value !== null) {
        flatten(value, `${name}.`);
      } else if (typeof value === 'boolean') {
        values[name] = value ? 'true' : 'false';
      } else if (value !== null && value !== undefined) {
        values[name] = String(value);
      }
    }
  };

  flatten(listing.specs, '');

  return values;
}
