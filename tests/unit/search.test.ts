import { describe, it, expect } from 'vitest';

import {
  buildTextSearchExpression,
  escapeLikePattern,
  normalizeQuery,
  parseRimDiameterQuery,
  parseTireSizeQuery,
  quoteForPostgrest,
} from '@/lib/search';

describe('escapeLikePattern', () => {
  it('escapes the LIKE wildcards and the backslash', () => {
    expect(escapeLikePattern('50% a_b c\\d')).toBe('50\\% a\\_b c\\\\d');
  });

  it('leaves an ordinary query untouched', () => {
    expect(escapeLikePattern('205/55 R16')).toBe('205/55 R16');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeLikePattern('%%__')).toBe('\\%\\%\\_\\_');
  });
});

describe('quoteForPostgrest', () => {
  it('quotes the value and escapes embedded quotes and backslashes', () => {
    expect(quoteForPostgrest('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it('quotes values containing PostgREST separators', () => {
    expect(quoteForPostgrest('foo,bar)')).toBe('"foo,bar)"');
  });

  it('escapes the backslash before the quote so the escape cannot be broken out of', () => {
    // A trailing backslash must not swallow the closing quote.
    expect(quoteForPostgrest('ends with\\')).toBe('"ends with\\\\"');
  });
});

describe('normalizeQuery', () => {
  it('collapses whitespace and trims without changing the characters', () => {
    expect(normalizeQuery('  205/55   R16  ')).toBe('205/55 R16');
  });
});

describe('buildTextSearchExpression', () => {
  const nasty = 'a"b\\c,d(e)%_ \'f';

  it('builds one ilike clause per searchable column', () => {
    const expression = buildTextSearchExpression('michelin');

    expect(expression.split('.ilike.')).toHaveLength(5);
    expect(expression.startsWith('title.ilike."')).toBe(true);
    expect(expression.includes('city.ilike."')).toBe(true);
    expect(expression.includes('specs->>brand.ilike."')).toBe(true);
    expect(expression.includes('specs->>model.ilike."')).toBe(true);
    expect(expression.endsWith('"')).toBe(true);
  });

  it('keeps the structure intact for input full of PostgREST metacharacters', () => {
    const expression = buildTextSearchExpression(nasty);

    const shape =
      /^title\.ilike\.(".*"),city\.ilike\.\1,specs->>brand\.ilike\.\1,specs->>model\.ilike\.\1$/;

    expect(shape.test(expression)).toBe(true);
  });

  it('quotes and escapes every dangerous character of the pattern', () => {
    const expression = buildTextSearchExpression(nasty);
    const shape =
      /^title\.ilike\.(".*"),city\.ilike\.\1,specs->>brand\.ilike\.\1,specs->>model\.ilike\.\1$/;
    const match = shape.exec(expression);

    expect(match).not.toBeNull();
    if (match === null) return;

    const quoted = match[1];
    expect(quoted).toBeDefined();
    if (quoted === undefined) return;

    expect(quoted.startsWith('"')).toBe(true);
    expect(quoted.endsWith('"')).toBe(true);

    // Remove every escape sequence; nothing unescaped may remain inside.
    const inner = quoted.slice(1, -1);
    const withoutEscapes = inner.replace(/\\\\/g, '').replace(/\\"/g, '');

    expect(withoutEscapes.includes('"')).toBe(false);
    expect(withoutEscapes.includes('\\')).toBe(false);

    // The LIKE wildcards typed by the user are escaped, the surrounding ones are not.
    expect(inner.includes('\\%')).toBe(true);
    expect(inner.includes('\\_')).toBe(true);
    expect(inner.startsWith('%')).toBe(true);
    expect(inner.endsWith('%')).toBe(true);
  });

  it('survives a single quote, a comma and parentheses', () => {
    expect(() => buildTextSearchExpression("O'Brien, (used)")).not.toThrow();

    const expression = buildTextSearchExpression("O'Brien, (used)");
    expect(expression.split('.ilike.')).toHaveLength(5);
    expect(expression.includes("O'Brien, (used)")).toBe(true);
  });
});

describe('parseTireSizeQuery', () => {
  it('understands every common way of typing a tire size', () => {
    const expected = { width: 205, aspect_ratio: 55, diameter: 16 };

    expect(parseTireSizeQuery('205/55 R16')).toEqual(expected);
    expect(parseTireSizeQuery('205 55 16')).toEqual(expected);
    expect(parseTireSizeQuery('205/55R16')).toEqual(expected);
    expect(parseTireSizeQuery('205/55/16')).toEqual(expected);
    expect(parseTireSizeQuery('205-55-16')).toEqual(expected);
    expect(parseTireSizeQuery('  205/55   r16  ')).toEqual(expected);
  });

  it('returns null for text that is not a size', () => {
    expect(parseTireSizeQuery('michelin primacy')).toBeNull();
    expect(parseTireSizeQuery('')).toBeNull();
    expect(parseTireSizeQuery('R17')).toBeNull();
    expect(parseTireSizeQuery('BBS CH-R')).toBeNull();
  });

  it('returns null for physically impossible numbers', () => {
    expect(parseTireSizeQuery('999/99 R99')).toBeNull();
    expect(parseTireSizeQuery('205/55 R99')).toBeNull();
    expect(parseTireSizeQuery('205/15 R16')).toBeNull();
    expect(parseTireSizeQuery('100/50 R16')).toBeNull();
  });
});

describe('parseRimDiameterQuery', () => {
  it('understands the usual notations', () => {
    expect(parseRimDiameterQuery('R17')).toBe(17);
    expect(parseRimDiameterQuery('17"')).toBe(17);
    expect(parseRimDiameterQuery('18 col')).toBe(18);
    expect(parseRimDiameterQuery('r 17')).toBe(17);
    expect(parseRimDiameterQuery('17 inch')).toBe(17);
  });

  it('returns null for anything else', () => {
    expect(parseRimDiameterQuery('michelin')).toBeNull();
    expect(parseRimDiameterQuery('205/55 R16')).toBeNull();
    expect(parseRimDiameterQuery('R99')).toBeNull();
    expect(parseRimDiameterQuery('')).toBeNull();
  });
});
