/**
 * Search input handling.
 *
 * Search runs entirely inside PostgreSQL through PostgREST — no paid search
 * service, no external index. Everything here is about making user input safe
 * to embed in a PostgREST filter and about understanding the way people
 * actually type a tire size.
 */

/**
 * Escapes the LIKE wildcards so that a query containing `%` or `_` matches
 * those characters literally instead of turning into a match-everything
 * pattern.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Makes a value safe to place inside a PostgREST `or=(...)` expression.
 *
 * PostgREST splits those expressions on commas and parentheses, so a value
 * that contains them must be double-quoted, and quotes/backslashes inside it
 * must be escaped. Applied together with escapeLikePattern this keeps queries
 * such as `205/55 R16`, `50%`, `a_b`, `O'Brien` and `foo,bar)` harmless.
 */
export function quoteForPostgrest(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Collapses whitespace and trims, without changing the user's characters. */
export function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export interface ParsedTireSize {
  readonly width: number;
  readonly aspect_ratio: number;
  readonly diameter: number;
}

/**
 * Recognises the common ways a tire size is typed:
 *   205/55 R16 · 205/55R16 · 205 55 16 · 205/55/16 · 205-55-16
 * Returns null when the text is not a tire size, so the caller can fall back
 * to a plain text search.
 */
export function parseTireSizeQuery(value: string): ParsedTireSize | null {
  const normalized = normalizeQuery(value).toUpperCase();

  const match =
    /(?:^|\s)(\d{3})\s*[\/\-\s]\s*(\d{2})\s*[\/\-\s]?\s*R?\s*(\d{2})(?:\s|$)/.exec(
      normalized
    );

  if (match === null) return null;

  const widthRaw = match[1];
  const aspectRaw = match[2];
  const diameterRaw = match[3];
  if (widthRaw === undefined || aspectRaw === undefined || diameterRaw === undefined) {
    return null;
  }

  const width = Number.parseInt(widthRaw, 10);
  const aspect_ratio = Number.parseInt(aspectRaw, 10);
  const diameter = Number.parseInt(diameterRaw, 10);

  // Reject numbers that are syntactically fine but physically impossible.
  if (width < 105 || width > 405) return null;
  if (aspect_ratio < 20 || aspect_ratio > 95) return null;
  if (diameter < 10 || diameter > 26) return null;

  return { width, aspect_ratio, diameter };
}

/**
 * Recognises a rim diameter typed on its own: `R17`, `17"`, `18 col`.
 */
export function parseRimDiameterQuery(value: string): number | null {
  const normalized = normalizeQuery(value).toUpperCase();
  const match = /^R?\s*(\d{2})\s*(?:"|''|COL|INCH)?$/.exec(normalized);

  if (match === null) return null;

  const raw = match[1];
  if (raw === undefined) return null;

  const diameter = Number.parseInt(raw, 10);
  if (diameter < 10 || diameter > 30) return null;

  return diameter;
}

/**
 * Builds the PostgREST `or=(...)` expression for a free-text query over the
 * title and the brand stored inside specs.
 */
export function buildTextSearchExpression(query: string): string {
  const pattern = quoteForPostgrest(`%${escapeLikePattern(normalizeQuery(query))}%`);

  return [
    `title.ilike.${pattern}`,
    `city.ilike.${pattern}`,
    `specs->>brand.ilike.${pattern}`,
    `specs->>model.ilike.${pattern}`,
  ].join(',');
}
