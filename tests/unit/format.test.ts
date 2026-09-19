import { describe, it, expect } from 'vitest';

import type { Locale } from '@/i18n/config';
import {
  formatDate,
  formatMeasure,
  formatNumber,
  formatPrice,
  toTelHref,
  toWhatsAppHref,
} from '@/lib/format';

/** Intl inserts non-breaking and narrow no-break spaces; tests ignore them. */
function normalize(value: string): string {
  return value.replace(/[   ]/g, ' ');
}

const LOCALES: readonly Locale[] = ['lt', 'ru', 'en'];

describe('formatPrice', () => {
  it('renders EUR in every locale and always contains the amount', () => {
    for (const locale of LOCALES) {
      const formatted = normalize(formatPrice(120, locale));

      expect(formatted).toMatch(/120/);
      expect(formatted).toMatch(/€|EUR/);
    }
  });

  it('keeps both cents of a non integer amount', () => {
    // A price with cents must always show two decimals ("120,50 €"), no matter
    // whether a whole amount was formatted first for the same locale.
    for (const locale of LOCALES) {
      const formatted = normalize(formatPrice(120.5, locale));

      expect(formatted).toMatch(/120[.,]50/);
      expect(formatted).toMatch(/€|EUR/);
    }
  });

  it('does not add ",00" to a whole amount', () => {
    for (const locale of LOCALES) {
      const formatted = normalize(formatPrice(120, locale));

      expect(formatted).not.toMatch(/120[.,]00/);
    }
  });

  it('formats zero', () => {
    expect(normalize(formatPrice(0, 'lt'))).toMatch(/0/);
  });
});

describe('formatNumber', () => {
  it('formats a number in each locale', () => {
    for (const locale of LOCALES) {
      expect(normalize(formatNumber(7.5, locale))).toMatch(/7[.,]5/);
    }
  });
});

describe('formatMeasure', () => {
  it('appends the unit after the localized number', () => {
    expect(normalize(formatMeasure(7.5, 'mm', 'en'))).toBe('7.5 mm');
  });
});

describe('formatDate', () => {
  it('returns an empty string for an invalid date string', () => {
    expect(formatDate('not-a-date', 'lt')).toBe('');
    expect(formatDate('', 'lt')).toBe('');
    expect(formatDate('2024-13-45T99:99:99Z', 'en')).toBe('');
  });

  it('formats a valid ISO date', () => {
    for (const locale of LOCALES) {
      const formatted = formatDate('2024-05-01T10:00:00.000Z', locale);

      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toMatch(/2024/);
    }
  });
});

describe('toTelHref', () => {
  it('strips spaces and keeps the leading plus', () => {
    expect(toTelHref('+370 643 95480')).toBe('tel:+37064395480');
  });

  it('strips punctuation from a local number', () => {
    expect(toTelHref('(8-643) 95.480')).toBe('tel:864395480');
  });
});

describe('toWhatsAppHref', () => {
  it('builds a wa.me link for an international number', () => {
    expect(toWhatsAppHref('+37064395480')).toBe('https://wa.me/37064395480');
    expect(toWhatsAppHref('+370 643 95480')).toBe('https://wa.me/37064395480');
  });

  it('returns null for a number without a leading plus', () => {
    expect(toWhatsAppHref('37064395480')).toBeNull();
    expect(toWhatsAppHref('864395480')).toBeNull();
  });

  it('returns null for an implausibly short or long number', () => {
    expect(toWhatsAppHref('+3706')).toBeNull();
    expect(toWhatsAppHref(`+${'9'.repeat(16)}`)).toBeNull();
  });
});
