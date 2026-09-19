/**
 * Locale-aware formatting.
 *
 * Prices, dates and numbers follow the visitor's chosen language; the currency
 * is always EUR. Formatters are cached because constructing Intl objects is
 * comparatively expensive and catalog pages render many of them.
 */

import { INTL_LOCALES, type Locale } from '@/i18n/config';

/**
 * Cached per locale AND per "whole amount or not", because the two use
 * different fraction digits: 120 € reads better than 120,00 €, while 120,50 €
 * must keep both cents. Caching on the locale alone would make the output
 * depend on whichever amount happened to be formatted first.
 */
const priceFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<Locale, Intl.NumberFormat>();
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();

export function formatPrice(amount: number, locale: Locale): string {
  const whole = Number.isInteger(amount);
  const key = `${locale}:${whole ? 'int' : 'dec'}`;

  let formatter = priceFormatters.get(key);

  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
    priceFormatters.set(key, formatter);
  }

  return formatter.format(amount);
}

export function formatNumber(value: number, locale: Locale): string {
  let formatter = numberFormatters.get(locale);

  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
      maximumFractionDigits: 2,
    });
    numberFormatters.set(locale, formatter);
  }

  return formatter.format(value);
}

export function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  let formatter = dateFormatters.get(locale);

  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    dateFormatters.set(locale, formatter);
  }

  return formatter.format(date);
}

/** `2.5 mm` style measurement, using the locale's decimal separator. */
export function formatMeasure(
  value: number,
  unit: string,
  locale: Locale
): string {
  return `${formatNumber(value, locale)} ${unit}`;
}

/**
 * Builds a tel: href. Keeps only digits and a leading plus so that a number
 * typed as "+370 643 95480" still dials correctly.
 */
export function toTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

/**
 * Builds a WhatsApp link, but only for numbers in international format.
 * Returns null otherwise, so the UI can hide the button instead of rendering
 * a link that leads nowhere.
 */
export function toWhatsAppHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (!cleaned.startsWith('+')) return null;

  const digits = cleaned.slice(1);
  if (digits.length < 8 || digits.length > 15) return null;

  return `https://wa.me/${digits}`;
}
