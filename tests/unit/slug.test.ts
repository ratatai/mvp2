import { describe, it, expect } from 'vitest';

import { buildListingSlug, isValidSlug, slugifyText } from '@/lib/slug';

/** The CHECK constraint the database enforces on listings.slug. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('slugifyText', () => {
  it('transliterates every Lithuanian diacritic', () => {
    expect(slugifyText('ąčęėįšųūž')).toBe('aceeisuuz');
    expect(slugifyText('ĄČĘĖĮŠŲŪŽ')).toBe('aceeisuuz');
  });

  it('transliterates Cyrillic', () => {
    expect(slugifyText('Привет Мир')).toBe('privet-mir');
    expect(slugifyText('Шины зимние')).toBe('shiny-zimnie');
  });

  it('strips punctuation and collapses dashes', () => {
    expect(slugifyText('Hello,,,   World!!!')).toBe('hello-world');
    expect(slugifyText('205/55 R16 — Michelin (naujos)')).toBe(
      '205-55-r16-michelin-naujos'
    );
  });

  it('never starts or ends with a dash', () => {
    const samples = [
      '---abc---',
      '  !!! Padangos !!!  ',
      '...',
      'Žiemos – padangos –',
      '/////',
    ];

    for (const sample of samples) {
      const slug = slugifyText(sample);
      expect(slug.startsWith('-')).toBe(false);
      expect(slug.endsWith('-')).toBe(false);
    }
  });

  it('returns an empty string when nothing slug-worthy is left', () => {
    expect(slugifyText('!!!')).toBe('');
    expect(slugifyText('')).toBe('');
    expect(slugifyText('   ')).toBe('');
  });

  it('keeps the result within the 80 character budget', () => {
    const slug = slugifyText('a'.repeat(200));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });
});

describe('buildListingSlug', () => {
  const titles: ReadonlyArray<readonly [string, string]> = [
    ['an ordinary title', 'Michelin Primacy 4 205/55 R16'],
    ['a Lithuanian title', 'Žieminės padangos Nokian Hakkapeliitta'],
    ['a Cyrillic title', 'Зимние шины Нокиан'],
    ['only punctuation', '!!! ??? ... ---'],
    ['an empty title', ''],
    ['whitespace only', '     '],
    ['a very long title', 'labai ilgas skelbimo pavadinimas '.repeat(10)],
  ];

  for (const [name, title] of titles) {
    it(`matches the database CHECK pattern for ${name}`, () => {
      const slug = buildListingSlug(title);

      expect(SLUG_PATTERN.test(slug)).toBe(true);
      expect(isValidSlug(slug)).toBe(true);
    });
  }

  it('falls back to a stem instead of producing a bare suffix', () => {
    const slug = buildListingSlug('!!!');

    expect(slug.startsWith('skelbimas-')).toBe(true);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });

  it('produces a different slug for two calls with the same title', () => {
    const first = buildListingSlug('Michelin Primacy 4 205/55 R16');
    const second = buildListingSlug('Michelin Primacy 4 205/55 R16');

    expect(first).not.toBe(second);
    expect(first.startsWith('michelin-primacy-4-205-55-r16-')).toBe(true);
    expect(second.startsWith('michelin-primacy-4-205-55-r16-')).toBe(true);
  });
});

describe('isValidSlug', () => {
  it('accepts a canonical slug and rejects a malformed one', () => {
    expect(isValidSlug('michelin-205-55-r16-abcd1234')).toBe(true);
    expect(isValidSlug('-leading')).toBe(false);
    expect(isValidSlug('trailing-')).toBe(false);
    expect(isValidSlug('double--dash')).toBe(false);
    expect(isValidSlug('Upper-Case')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});
