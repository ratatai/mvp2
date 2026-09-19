/**
 * Route helpers.
 *
 * URL segments are Lithuanian in every language. Keeping one stable set of
 * paths means a shared link always resolves, and search engines see one
 * canonical address per listing instead of three competing ones.
 */

import type { ListingCategory } from '@/domain/canonical';
import type { Locale } from '@/i18n/config';

/** Category ↔ URL segment. The canonical value keeps its underscore. */
export const CATEGORY_SLUGS: Readonly<Record<ListingCategory, string>> = {
  padangos: 'padangos',
  ratlankiai: 'ratlankiai',
  komplektiniai_ratai: 'komplektiniai-ratai',
};

const SLUG_TO_CATEGORY: Readonly<Record<string, ListingCategory>> = {
  padangos: 'padangos',
  ratlankiai: 'ratlankiai',
  'komplektiniai-ratai': 'komplektiniai_ratai',
};

export function categoryFromSlug(slug: string): ListingCategory | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}

const join = (locale: Locale, path: string): string =>
  path === '' ? `/${locale}` : `/${locale}/${path}`;

export const routes = {
  home: (locale: Locale) => join(locale, ''),
  catalog: (locale: Locale) => join(locale, 'skelbimai'),
  category: (locale: Locale, category: ListingCategory) =>
    join(locale, `skelbimai/${CATEGORY_SLUGS[category]}`),
  listing: (locale: Locale, slug: string) => join(locale, `skelbimas/${slug}`),
  createListing: (locale: Locale) => join(locale, 'naujas-skelbimas'),
  editListing: (locale: Locale, id: string) =>
    join(locale, `mano/skelbimai/${id}/redaguoti`),
  login: (locale: Locale) => join(locale, 'prisijungti'),
  register: (locale: Locale) => join(locale, 'registracija'),
  passwordRecovery: (locale: Locale) => join(locale, 'slaptazodzio-atkurimas'),
  passwordReset: (locale: Locale) => join(locale, 'naujas-slaptazodis'),
  authNotice: (locale: Locale) => join(locale, 'auth/pranesimas'),
  dashboard: (locale: Locale) => join(locale, 'mano'),
  myListings: (locale: Locale) => join(locale, 'mano/skelbimai'),
  profile: (locale: Locale) => join(locale, 'mano/profilis'),
  privacy: (locale: Locale) => join(locale, 'privatumo-politika'),
  terms: (locale: Locale) => join(locale, 'taisykles'),
} as const;

/** Paths that must never be indexed and always require a session. */
export const PROTECTED_SEGMENTS = ['mano', 'naujas-skelbimas'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_SEGMENTS.some(
    (segment) =>
      pathname.includes(`/${segment}/`) || pathname.endsWith(`/${segment}`)
  );
}

/** Swaps the locale prefix of the current path, keeping the rest intact. */
export function withLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter((segment) => segment.length > 0);

  if (segments.length === 0) return `/${locale}`;

  segments[0] = locale;
  return `/${segments.join('/')}`;
}
