/**
 * Readings → listing fields.
 *
 * A reading becomes an accepted field only when the model was confident AND
 * the value passes the same checks the site applies. Anything else becomes a
 * suggestion the seller has to confirm, or nothing at all (the bot asks).
 */

import type { TyreDraft } from '../draft';
import {
  dotDateGroup,
  normaliseDot,
  parseServiceDescription,
  parseText,
  parseTyreSize,
  yearFromDotDate,
} from '../parse';
import type { PhotoReadings, Reading } from './types';

export interface NormalizedReadings {
  /** Read with certainty; goes straight into the draft. */
  readonly accepted: Partial<TyreDraft>;
  /** Read with doubt; the seller is asked to confirm each one. */
  readonly suggestions: Partial<TyreDraft>;
  readonly notTyres: boolean;
  readonly mixedTyres: boolean;
}

type Sink = { accepted: Partial<TyreDraft>; suggestions: Partial<TyreDraft> };

function put<T>(sink: Sink, reading: Reading<T>, patch: Partial<TyreDraft> | null, alwaysConfirm = false): void {
  if (reading.value === null || patch === null) return;
  const target = reading.confidence === 'high' && !alwaysConfirm ? sink.accepted : sink.suggestions;
  Object.assign(target, patch);
}

export function normalizeReadings(readings: PhotoReadings, currentYear: number): NormalizedReadings {
  const sink: Sink = { accepted: {}, suggestions: {} };

  const brand = readings.brand.value === null ? null : parseText(readings.brand.value, 60);
  put(sink, readings.brand, brand === null ? null : { brand });

  const model = readings.model.value === null ? null : parseText(readings.model.value, 80);
  put(sink, readings.model, model === null ? null : { model });

  const size = readings.size.value === null ? null : parseTyreSize(readings.size.value);
  put(sink, readings.size, size === null ? null : { ...size });

  const service =
    readings.service_description.value === null
      ? null
      : parseServiceDescription(readings.service_description.value);
  put(sink, readings.service_description, service === null ? null : { ...service });

  put(sink, readings.season, readings.season.value === null ? null : { season: readings.season.value });

  // DOT: the year is derived from the code by this code, never taken from the model.
  const dot = readings.dot.value === null ? null : normaliseDot(readings.dot.value);
  if (dot !== null) {
    const group = dotDateGroup(dot);
    const year = group === null ? null : yearFromDotDate(group, currentYear);
    const patch: Partial<TyreDraft> = year === null ? { dot } : { dot, manufacturing_year: year };
    put(sink, readings.dot, patch);
  }

  put(sink, readings.xl, readings.xl.value === null ? null : { xl: readings.xl.value });
  put(sink, readings.run_flat, readings.run_flat.value === null ? null : { run_flat: readings.run_flat.value });
  put(sink, readings.studded, readings.studded.value === null ? null : { studded: readings.studded.value });

  const tread = readings.tread_depth.value;
  put(
    sink,
    readings.tread_depth,
    tread === null || tread < 0 || tread > 20 ? null : { tread_depth: Math.round(tread * 2) / 2 }
  );

  // Condition and damage are judgement calls about someone's property: always confirmed.
  put(sink, readings.condition, readings.condition.value === null ? null : { condition: readings.condition.value }, true);
  const defects = readings.defects.value === null ? null : parseText(readings.defects.value, 500);
  put(sink, readings.defects, defects === null ? null : { defects }, true);

  // Photos may show fewer tyres than are for sale: a suggestion only.
  if (readings.tyres_visible !== null && readings.tyres_visible !== undefined && readings.tyres_visible <= 100) {
    sink.suggestions.quantity = readings.tyres_visible;
  }

  return {
    accepted: sink.accepted,
    suggestions: sink.suggestions,
    notTyres: !readings.is_tyre_photo,
    mixedTyres: readings.mixed_tyres === true,
  };
}
