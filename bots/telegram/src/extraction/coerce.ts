/**
 * Turns whatever JSON a model returned into a well-typed PhotoReadings.
 *
 * A field with the wrong type or shape becomes "not read" (null, low) rather
 * than failing the whole photo set — the bot will simply ask about it.
 */

import type { Confidence, PhotoReadings, Reading } from './types';

type Guard<T> = (v: unknown) => v is T;

const isString: Guard<string> = (v): v is string => typeof v === 'string' && v.trim().length > 0;
const isBool: Guard<boolean> = (v): v is boolean => typeof v === 'boolean';
const isNumber: Guard<number> = (v): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf =
  <T extends string>(values: readonly T[]): Guard<T> =>
  (v): v is T =>
    typeof v === 'string' && (values as readonly string[]).includes(v);

const NOT_READ = { value: null, confidence: 'low' as Confidence };

function reading<T>(raw: unknown, guard: Guard<T>): Reading<T> {
  if (typeof raw !== 'object' || raw === null) return NOT_READ;
  const r = raw as Record<string, unknown>;
  const confidence: Confidence = r.confidence === 'high' ? 'high' : 'low';
  const evidence = typeof r.evidence === 'string' ? r.evidence.slice(0, 200) : undefined;
  if (!guard(r.value)) return evidence === undefined ? NOT_READ : { ...NOT_READ, evidence };
  const value = typeof r.value === 'string' ? (r.value.trim() as T) : r.value;
  return evidence === undefined ? { value, confidence } : { value, confidence, evidence };
}

export function coerceReadings(raw: unknown): PhotoReadings | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  return {
    is_tyre_photo: r.is_tyre_photo !== false,
    mixed_tyres: r.mixed_tyres === true,
    tyres_visible:
      typeof r.tyres_visible === 'number' && Number.isInteger(r.tyres_visible) && r.tyres_visible > 0
        ? r.tyres_visible
        : null,
    brand: reading(r.brand, isString),
    model: reading(r.model, isString),
    size: reading(r.size, isString),
    service_description: reading(r.service_description, isString),
    season: reading(r.season, oneOf(['summer', 'winter', 'all_season'] as const)),
    dot: reading(r.dot, isString),
    xl: reading(r.xl, isBool),
    run_flat: reading(r.run_flat, isBool),
    studded: reading(r.studded, isBool),
    tread_depth: reading(r.tread_depth, isNumber),
    condition: reading(r.condition, oneOf(['new', 'used'] as const)),
    defects: reading(r.defects, isString),
  };
}

/** Pulls the first JSON object out of a text reply (for providers without tool calls). */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
