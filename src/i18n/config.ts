/**
 * Locale configuration.
 *
 * Lithuanian is the primary language and the default. Every page lives under a
 * locale prefix (/lt, /ru, /en) so that a URL is always unambiguous, the chosen
 * language survives a refresh, and search engines can index one canonical URL
 * per language.
 */

export const LOCALES = ['lt', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'lt';

/** Cookie that remembers the visitor's choice across sessions. */
export const LOCALE_COOKIE = 'ratatai_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** BCP-47 tags used for Intl number, currency and date formatting. */
export const INTL_LOCALES: Readonly<Record<Locale, string>> = {
  lt: 'lt-LT',
  ru: 'ru-RU',
  en: 'en-GB',
};

/** Native language names for the switcher — never translated. */
export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  lt: 'Lietuvių',
  ru: 'Русский',
  en: 'English',
};

export const LOCALE_SHORT_LABELS: Readonly<Record<Locale, string>> = {
  lt: 'LT',
  ru: 'RU',
  en: 'EN',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best locale from an Accept-Language header, falling back to
 * Lithuanian. Used only on the very first visit, before the cookie exists.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (acceptLanguage === null) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam === undefined ? 1 : Number.parseFloat(qParam.trim().slice(2));
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
