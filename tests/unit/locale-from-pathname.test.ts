import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, localeFromPathname } from '@/i18n/config';

describe('localeFromPathname', () => {
  it('reads the locale from the first path segment', () => {
    expect(localeFromPathname('/lt/unknown')).toBe('lt');
    expect(localeFromPathname('/ru/unknown/deeper')).toBe('ru');
    expect(localeFromPathname('/en')).toBe('en');
    expect(localeFromPathname('//en/x')).toBe('en');
  });

  it('only accepts a locale as the first segment', () => {
    expect(localeFromPathname('/skelbimai/ru')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('/russian/x')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('/RU/x')).toBe(DEFAULT_LOCALE);
  });

  it('falls back to the default locale when there is no path', () => {
    expect(localeFromPathname('/')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname(null)).toBe(DEFAULT_LOCALE);
  });
});
