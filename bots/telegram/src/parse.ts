/**
 * Pure parsers for values a seller types into the chat, and for the markings
 * a vision model reads off a sidewall. Every function returns null when the
 * input is not a clean, valid value — it never guesses or repairs.
 *
 * Ranges mirror src/domain/listing.validation.ts so a value accepted here is
 * also accepted by the site's schema.
 */

/** "6,5", "6.5 mm", " 7 " → number. */
export function parseDecimal(raw: string): number | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s*(mm|мм|eur|€|euro|eurų|евро|vnt\.?|шт\.?)\s*$/u, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseIntIn(raw: string, min: number, max: number): number | null {
  const value = parseDecimal(raw);
  if (value === null || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

export interface TyreSize {
  readonly width: number;
  readonly aspect_ratio: number;
  readonly diameter: number;
}

/**
 * Parses the printed size: "205/55 R16", "205/55R16", "205 55 16",
 * "205/55 ZR17", "225/45 R 18". Ranges follow the site schema (width is NOT
 * capped at 305).
 */
export function parseTyreSize(raw: string): TyreSize | null {
  const match = /^(\d{3})\s*[/\s]\s*(\d{2})\s*(?:Z?R\s*F?|-|\s)\s*(\d{2})\s*C?$/i.exec(
    raw.trim().replace(/\s+/g, ' ')
  );
  if (match === null) return null;
  const width = Number(match[1]);
  const aspect = Number(match[2]);
  const diameter = Number(match[3]);
  if (width < 105 || width > 405) return null;
  if (aspect < 20 || aspect > 95) return null;
  if (diameter < 10 || diameter > 26) return null;
  return { width, aspect_ratio: aspect, diameter };
}

export interface ServiceDescription {
  readonly load_index: number;
  readonly speed_index: string;
}

/** "91V", "91 V", "102/100T" (first load index is the single-tyre one). */
export function parseServiceDescription(raw: string): ServiceDescription | null {
  const match = /^\s*(\d{2,3})(?:\/\d{2,3})?\s*([A-Za-z]{1,2})\s*$/.exec(raw);
  if (match === null) return null;
  const load = Number(match[1]);
  const speed = (match[2] ?? '').toUpperCase();
  if (load < 20 || load > 130) return null;
  // Real speed symbols. "ZR" in a size is not a speed index on its own.
  if (!/^(?:[A-HJ-NP-W]|Y|\(Y\))$/.test(speed)) return null;
  return { load_index: load, speed_index: speed };
}

/**
 * DOT date code: the last group of a DOT marking is WWYY (four digits since
 * 2000). Returns the four-digit year, or null when the week is impossible or
 * the code is not a WWYY group. Three-digit pre-2000 codes return null — the
 * decade is ambiguous and the bot asks instead.
 */
export function yearFromDotDate(dateCode: string, currentYear: number): number | null {
  const match = /^(\d{2})(\d{2})$/.exec(dateCode.trim());
  if (match === null) return null;
  const week = Number(match[1]);
  const yy = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const year = 2000 + yy;
  if (year > currentYear) return null;
  return year;
}

/**
 * Normalises a DOT marking to the form the site stores (A-Z0-9, 3–13 chars):
 * "DOT EX 2B 4521" → "EX2B4521". Returns null if the result is not storable.
 */
export function normaliseDot(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/^\s*DOT\s*/, '').replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{3,13}$/.test(cleaned) ? cleaned : null;
}

/** The WWYY date group at the end of a normalised DOT code, if any. */
export function dotDateGroup(dot: string): string | null {
  const match = /(\d{4})$/.exec(dot);
  return match?.[1] ?? null;
}

/** Price in whole euros or euro cents: "120", "120,50 €". */
export function parsePrice(raw: string): number | null {
  const value = parseDecimal(raw);
  if (value === null || value < 0 || value > 1_000_000) return null;
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return null;
  return value;
}

/** Trimmed free text within a length limit, or null. */
export function parseText(raw: string, max: number, min = 1): string | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length >= min && value.length <= max ? value : null;
}
