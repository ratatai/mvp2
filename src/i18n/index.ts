/**
 * Dictionary access.
 *
 * Translations exist only at the UI layer: nothing here is ever written to the
 * database, and canonical values keep their English identifiers everywhere.
 *
 * `ru` and `en` are typed as `Dictionary`, so TypeScript fails the build if a
 * key is missing from or added to a translation — the three files cannot drift
 * apart silently.
 */

import en from './dictionaries/en.json';
import lt from './dictionaries/lt.json';
import ru from './dictionaries/ru.json';
import { DEFAULT_LOCALE, type Locale } from './config';

/** Lithuanian is the source of truth for the shape of every dictionary. */
export type Dictionary = typeof lt;

const ruDictionary: Dictionary = ru;
const enDictionary: Dictionary = en;

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
  lt,
  ru: ruDictionary,
  en: enDictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Replaces `{name}` placeholders. A placeholder with no matching value is
 * left untouched rather than replaced with "undefined".
 */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './config';
