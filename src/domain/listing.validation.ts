/**
 * Runtime validation for the RATATAI data contract.
 *
 * Every value that crosses the application boundary — a form submission, a
 * JSONB blob read back from Postgres, an imported row — passes through these
 * schemas. They are deliberately `.strict()`: an object shaped like tire specs
 * can never be accepted as rim specs, and a mixed or truncated object is
 * rejected instead of being silently repaired.
 *
 * No schema in this file has a `.default()`. A missing optional value stays
 * missing; the contract forbids substituting the current year, `0 mm`,
 * `4 pieces`, a random brand or a random city.
 */

import { z } from 'zod';

import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  MODERATION_STATUSES,
  RIM_MATERIALS,
  RIM_ORIGINS,
  RIM_REPAIRS,
  SALE_UNITS,
  TIRE_SEASONS,
  type ListingCategory,
} from './canonical';
import type { RimSpecs, TireSpecs, WheelSpecs } from './listing.contract';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** A required, non-empty, trimmed string. Whitespace-only input is invalid. */
const requiredText = (max: number, min = 1) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min).max(max));

/** An optional string: absent, or non-empty after trimming. */
const optionalText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(max))
    .optional();

const integerIn = (min: number, max: number) =>
  z.number().int().gte(min).lte(max);

const decimalIn = (min: number, max: number) =>
  z.number().finite().gte(min).lte(max);

export const categorySchema = z.enum(LISTING_CATEGORIES);
export const conditionSchema = z.enum(LISTING_CONDITIONS);
export const statusSchema = z.enum(LISTING_STATUSES);
export const moderationStatusSchema = z.enum(MODERATION_STATUSES);
export const seasonSchema = z.enum(TIRE_SEASONS);
export const materialSchema = z.enum(RIM_MATERIALS);

/* -------------------------------------------------------------------------- */
/* PCD                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Canonical PCD form: `<bolts>x<circle diameter>`, e.g. `4x100`, `5x112`,
 * `5x114.3`. Rejects `5x`, `x112`, `5x11.4.3`, zero and negative values.
 */
export const PCD_PATTERN = /^([1-9]\d?)x(\d{1,3}(?:\.\d{1,2})?)$/;

export interface ParsedPcd {
  readonly boltCount: number;
  readonly circleDiameter: number;
}

/** Parses a PCD string, returning null when it is not a valid PCD. */
export function parsePcd(value: unknown): ParsedPcd | null {
  if (typeof value !== 'string') return null;

  const match = PCD_PATTERN.exec(value.trim());
  if (match === null) return null;

  const boltsRaw = match[1];
  const circleRaw = match[2];
  if (boltsRaw === undefined || circleRaw === undefined) return null;

  const boltCount = Number.parseInt(boltsRaw, 10);
  const circleDiameter = Number.parseFloat(circleRaw);

  if (!Number.isFinite(circleDiameter) || circleDiameter <= 0) return null;
  if (boltCount < 3 || boltCount > 10) return null;
  if (circleDiameter < 80 || circleDiameter > 200) return null;

  return { boltCount, circleDiameter };
}

export const pcdSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => parsePcd(value) !== null, {
    message: 'invalid_pcd',
  });

/* -------------------------------------------------------------------------- */
/* Tires                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ranges cover real passenger, SUV and van sizes. Width is intentionally not
 * capped at 305 — 355 and 375 section tires exist and must be listable.
 */
export const tireSpecsSchema = z
  .object({
    brand: requiredText(60),
    model: optionalText(80),
    width: integerIn(105, 405),
    aspect_ratio: integerIn(20, 95),
    diameter: integerIn(10, 26),
    season: seasonSchema,
    tread_depth: decimalIn(0, 20).optional(),
    manufacturing_year: integerIn(1980, 2100).optional(),
    dot: z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{3,13}$/))
      .optional(),
    load_index: integerIn(20, 130).optional(),
    speed_index: z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{1,2}$/))
      .optional(),
    xl: z.boolean().optional(),
    run_flat: z.boolean().optional(),
    studded: z.boolean().optional(),
    defects: optionalText(500),
    sale_unit: z.enum(SALE_UNITS).optional(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Rims                                                                        */
/* -------------------------------------------------------------------------- */

export const rimSpecsSchema = z
  .object({
    brand: requiredText(60),
    model: optionalText(80),
    diameter: integerIn(10, 30),
    rim_width: decimalIn(3, 16),
    bolt_count: integerIn(3, 10),
    pcd: pcdSchema,
    cb: decimalIn(40, 130),
    et: integerIn(-60, 90),
    material: materialSchema,
    oem_code: optionalText(60),
    origin: z.enum(RIM_ORIGINS).optional(),
    fitment: optionalText(300),
    color: optionalText(40),
    repairs: z.array(z.enum(RIM_REPAIRS)).max(4).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = parsePcd(value.pcd);

    if (parsed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pcd'],
        message: 'invalid_pcd',
      });
      return;
    }

    // The bolt count must agree with the first part of the PCD.
    if (parsed.boltCount !== value.bolt_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bolt_count'],
        message: 'bolt_count_pcd_mismatch',
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* Complete wheels                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The nested halves reuse the rim and tire schemas, so a complete wheel is
 * validated exactly as strictly as its parts, plus a physical sanity check:
 * a 17" tire cannot sit on an 18" rim.
 */
export const wheelSpecsSchema = z
  .object({
    rim: z
      .object({ condition: conditionSchema.optional() })
      .strict()
      .partial()
      .and(rimSpecsSchema),
    tire: z
      .object({ condition: conditionSchema.optional() })
      .strict()
      .partial()
      .and(tireSpecsSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.rim.diameter !== value.tire.diameter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tire', 'diameter'],
        message: 'wheel_diameter_mismatch',
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* Category dispatch                                                           */
/* -------------------------------------------------------------------------- */

export type SpecsParseResult =
  | { readonly ok: true; readonly category: 'padangos'; readonly specs: TireSpecs }
  | { readonly ok: true; readonly category: 'ratlankiai'; readonly specs: RimSpecs }
  | {
      readonly ok: true;
      readonly category: 'komplektiniai_ratai';
      readonly specs: WheelSpecs;
    }
  | { readonly ok: false; readonly issues: readonly string[] };

function collectIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Validates a raw specs object against the schema required by `category`.
 *
 * Never throws: a mixed, damaged or incomplete object comes back as
 * `{ ok: false }` with a list of issues, so the caller can render field errors
 * instead of crashing the request.
 */
export function parseSpecsForCategory(
  category: ListingCategory,
  input: unknown
): SpecsParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, issues: ['specs: not_an_object'] };
  }

  switch (category) {
    case 'padangos': {
      const result = tireSpecsSchema.safeParse(input);
      return result.success
        ? { ok: true, category, specs: result.data }
        : { ok: false, issues: collectIssues(result.error) };
    }
    case 'ratlankiai': {
      const result = rimSpecsSchema.safeParse(input);
      return result.success
        ? { ok: true, category, specs: result.data }
        : { ok: false, issues: collectIssues(result.error) };
    }
    case 'komplektiniai_ratai': {
      const result = wheelSpecsSchema.safeParse(input);
      return result.success
        ? { ok: true, category, specs: result.data }
        : { ok: false, issues: collectIssues(result.error) };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Listing draft (create / edit form payload)                                  */
/* -------------------------------------------------------------------------- */

const listingCoreSchema = z.object({
  title: requiredText(140, 3),
  description: requiredText(5000, 10),
  condition: conditionSchema,
  price: z
    .number()
    .finite()
    .nonnegative()
    .max(1_000_000)
    .refine((value) => Number.isInteger(Math.round(value * 100)), {
      message: 'price_precision',
    }),
  quantity: integerIn(1, 100),
  city: requiredText(80),
  area: optionalText(120),
});

export const listingDraftSchema = z
  .object({
    category: categorySchema,
    specs: z.unknown(),
  })
  .and(listingCoreSchema)
  .superRefine((value, ctx) => {
    const result = parseSpecsForCategory(value.category, value.specs);

    if (!result.ok) {
      for (const issue of result.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specs'],
          message: issue,
        });
      }
    }
  });

export type ListingDraftInput = z.input<typeof listingDraftSchema>;

export interface ValidatedDraft {
  readonly category: ListingCategory;
  readonly title: string;
  readonly description: string;
  readonly condition: 'new' | 'used';
  readonly price: number;
  readonly quantity: number;
  readonly city: string;
  readonly area?: string;
  readonly specs: TireSpecs | RimSpecs | WheelSpecs;
}

export type DraftParseResult =
  | { readonly ok: true; readonly draft: ValidatedDraft }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Validates a complete create/edit payload. Never throws. */
export function parseListingDraft(input: unknown): DraftParseResult {
  const base = listingDraftSchema.safeParse(input);

  if (!base.success) {
    return { ok: false, issues: collectIssues(base.error) };
  }

  const specs = parseSpecsForCategory(base.data.category, base.data.specs);

  if (!specs.ok) {
    return { ok: false, issues: specs.issues };
  }

  const { area, ...rest } = base.data;

  return {
    ok: true,
    draft: area === undefined
      ? { ...rest, specs: specs.specs }
      : { ...rest, area, specs: specs.specs },
  };
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers derived from structured data                             */
/* -------------------------------------------------------------------------- */

/**
 * Builds `205/55 R16` from the structured fields. The string form is always
 * derived and never the stored source of truth.
 */
export function formatTireSize(specs: {
  width: number;
  aspect_ratio: number;
  diameter: number;
}): string {
  return `${specs.width}/${specs.aspect_ratio} R${specs.diameter}`;
}

/** Builds `8.5Jx18 ET35` from the structured rim fields. */
export function formatRimSize(specs: {
  rim_width: number;
  diameter: number;
  et: number;
}): string {
  return `${specs.rim_width}Jx${specs.diameter} ET${specs.et}`;
}
