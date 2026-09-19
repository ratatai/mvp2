/**
 * Shared helpers and UI strings for the end-to-end suite.
 *
 * The visible strings are copied from src/i18n/dictionaries/*.json. They are
 * duplicated here on purpose: tests/e2e is excluded from the app tsconfig, so
 * importing the dictionaries through the `@` alias is not available, and a
 * literal string is also what makes a broken translation fail the test.
 *
 * Nothing in this file is a fixture of real data. Any credential, email or
 * phone number used by the suite comes from an environment variable and is
 * expected to be an obviously synthetic test account.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/* Routes — Lithuanian in every language, see src/lib/routes.ts                */
/* -------------------------------------------------------------------------- */

export type Locale = 'lt' | 'ru' | 'en';

export const routes = {
  home: (locale: Locale): string => `/${locale}`,
  catalog: (locale: Locale): string => `/${locale}/skelbimai`,
  tires: (locale: Locale): string => `/${locale}/skelbimai/padangos`,
  rims: (locale: Locale): string => `/${locale}/skelbimai/ratlankiai`,
  wheels: (locale: Locale): string => `/${locale}/skelbimai/komplektiniai-ratai`,
  listing: (locale: Locale, slug: string): string => `/${locale}/skelbimas/${slug}`,
  createListing: (locale: Locale): string => `/${locale}/naujas-skelbimas`,
  login: (locale: Locale): string => `/${locale}/prisijungti`,
  register: (locale: Locale): string => `/${locale}/registracija`,
  passwordRecovery: (locale: Locale): string =>
    `/${locale}/slaptazodzio-atkurimas`,
  dashboard: (locale: Locale): string => `/${locale}/mano`,
  myListings: (locale: Locale): string => `/${locale}/mano/skelbimai`,
  profile: (locale: Locale): string => `/${locale}/mano/profilis`,
} as const;

/* -------------------------------------------------------------------------- */
/* Visible strings                                                             */
/* -------------------------------------------------------------------------- */

export const LT = {
  language: 'Kalba',
  languageName: 'Lietuvių',
  navCatalog: 'Skelbimai',
  navCreateListing: 'Įdėti skelbimą',
  navWheels: 'Komplektiniai ratai',
  catalogTitle: 'Skelbimai',
  categoryTires: 'Padangos',
  categoryRims: 'Ratlankiai',
  categoryWheels: 'Komplektiniai ratai',
  filtersOpen: 'Filtrai',
  filtersTitle: 'Filtrai',
  filterCondition: 'Būklė',
  filterCity: 'Miestas',
  filterPriceFrom: 'Kaina nuo',
  conditionNew: 'Naujos',
  apply: 'Taikyti',
  reset: 'Išvalyti',
  noResultsTitle: 'Pagal šiuos filtrus nieko neradome',
  resultsCountPrefix: 'Rasta skelbimų:',
  specsTitle: 'Techniniai duomenys',
  heroCta: 'Žiūrėti skelbimus',
  notFoundTitle: 'Puslapis nerastas',
  loginTitle: 'Prisijungimas',
  loginSubmit: 'Prisijungti',
  registerTitle: 'Registracija',
  registerSubmit: 'Registruotis',
  recoveryTitle: 'Slaptažodžio atkūrimas',
  recoverySubmit: 'Siųsti nuorodą',
  email: 'El. paštas',
  password: 'Slaptažodis',
  passwordConfirm: 'Pakartok slaptažodį',
  errorInvalidCredentials: 'Neteisingas el. paštas arba slaptažodis.',
  errorEmailInvalid: 'Įvesk teisingą el. pašto adresą.',
  errorGeneric: 'Nepavyko atlikti veiksmo. Pabandyk dar kartą.',
  errorRateLimit: 'Per daug bandymų. Pabandyk po kelių minučių.',
} as const;

export const RU = {
  language: 'Язык',
  languageName: 'Русский',
  navCatalog: 'Объявления',
  navCreateListing: 'Подать объявление',
  navWheels: 'Колёса в сборе',
  catalogTitle: 'Объявления',
  categoryTires: 'Шины',
  categoryRims: 'Диски',
  categoryWheels: 'Колёса в сборе',
  filtersOpen: 'Фильтры',
  specsTitle: 'Технические данные',
  notFoundTitle: 'Страница не найдена',
  loginTitle: 'Вход',
  loginSubmit: 'Войти',
  email: 'Эл. почта',
} as const;

export const EN = {
  language: 'Language',
  languageName: 'English',
  navCatalog: 'Listings',
  navCreateListing: 'Post a listing',
  navWheels: 'Complete wheels',
  catalogTitle: 'Listings',
  categoryTires: 'Tyres',
  categoryRims: 'Rims',
  categoryWheels: 'Complete wheels',
  filtersOpen: 'Filters',
  specsTitle: 'Technical specs',
  notFoundTitle: 'Page not found',
  loginTitle: 'Log in',
  loginSubmit: 'Log in',
  email: 'Email',
} as const;

/* -------------------------------------------------------------------------- */
/* Catalog helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Every listing card currently rendered. Cards are `<article>` elements. */
export function listingCards(page: Page): Locator {
  return page.getByRole('article');
}

/**
 * How many listings the catalog rendered. A fresh install has an empty
 * database, so specs that need data call this and skip rather than fail.
 */
export async function countListings(page: Page): Promise<number> {
  return listingCards(page).count();
}

/**
 * Returns a locator for the filter form that the current viewport actually
 * shows.
 *
 * Below the `lg` breakpoint the panel lives in a drawer behind a "Filtrai"
 * button; at desktop width it is a sidebar that is always open. Both render
 * the same fields, so every caller gets the same shape back.
 */
export async function openFilterForm(page: Page): Promise<Locator> {
  const trigger = page.getByRole('button', { name: new RegExp(LT.filtersOpen) });

  if (await trigger.isVisible()) {
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: LT.filtersTitle });
    await expect(drawer).toBeVisible();
    return drawer;
  }

  // At desktop width the drawer is not rendered at all, so the sidebar form
  // — the one carrying the "Taikyti" button — is the only one in the DOM.
  const sidebar = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: LT.apply }) });

  await expect(sidebar).toBeVisible();
  return sidebar;
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Pixels the document overflows the viewport horizontally. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
}

/**
 * Asserts the page does not scroll sideways. One pixel of tolerance absorbs
 * sub-pixel rounding in the browser's layout engine.
 *
 * Uses `expect.poll` rather than a sleep so fonts and images are allowed to
 * settle without a fixed wait.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () => horizontalOverflow(page), {
      message: 'the page scrolls horizontally',
      timeout: 10_000,
    })
    .toBeLessThanOrEqual(1);
}

/** Asserts an element is at least 44x44 CSS pixels — the minimum tap target. */
export async function expectTapTarget(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();

  expect(box, 'the element has no layout box').not.toBeNull();
  if (box === null) return;

  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

/* -------------------------------------------------------------------------- */
/* Language switching                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Switches the interface language through the header switcher.
 *
 * `from` names the language currently shown, because the switcher's own
 * accessible label is translated too.
 */
export async function switchLanguage(
  page: Page,
  from: Locale,
  to: Locale
): Promise<void> {
  const triggerLabel = { lt: LT.language, ru: RU.language, en: EN.language }[from];
  const optionLabel = {
    lt: LT.languageName,
    ru: RU.languageName,
    en: EN.languageName,
  }[to];

  await page.getByRole('button', { name: triggerLabel }).click();
  await page.getByRole('option', { name: optionLabel }).click();
  await expect(page).toHaveURL(new RegExp(`^[^?]*/${to}(/|$|\\?)`));
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

/** Reads one query parameter from the page's current URL. */
export function queryParam(page: Page, key: string): string | null {
  return new URL(page.url()).searchParams.get(key);
}

/** The path part of the page's current URL, without the origin. */
export function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}
