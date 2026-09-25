/**
 * Catalog browsing.
 *
 * The catalog is the only part of the site a visitor sees before signing up,
 * so it has to work anonymously, keep its filter state in the URL, and behave
 * sensibly on a database that is still empty.
 */

import { expect, test } from '@playwright/test';

import {
  countListings,
  EN,
  LT,
  listingCards,
  openFilterForm,
  pathOf,
  queryParam,
  routes,
  RU,
} from './helpers';

test.describe('public catalog', () => {
  test('opens for an anonymous visitor without redirecting to the login page', async ({
    page,
  }) => {
    const response = await page.goto(routes.catalog('lt'));

    expect(response?.status()).toBeLessThan(400);
    expect(pathOf(page)).toBe(routes.catalog('lt'));
    expect(page.url()).not.toContain('prisijungti');

    await expect(
      page.getByRole('heading', { level: 1, name: LT.catalogTitle })
    ).toBeVisible();
  });

  test('renders either results or the empty state, never a broken page', async ({
    page,
  }) => {
    await page.goto(routes.catalog('lt'));

    const results = page.getByText(LT.resultsCountPrefix);
    const empty = page.getByRole('heading', { name: LT.noResultsTitle });

    // This is the one spec that must cope with an empty database *as its
    // subject*: exactly one of the two states has to be on screen.
    await expect(results.or(empty).first()).toBeVisible();
  });

  test('shows the correct heading on each of the three category routes', async ({
    page,
  }) => {
    const cases = [
      { path: routes.tires('lt'), heading: LT.categoryTires },
      { path: routes.rims('lt'), heading: LT.categoryRims },
      { path: routes.wheels('lt'), heading: LT.categoryWheels },
    ] as const;

    for (const { path, heading } of cases) {
      await page.goto(path);
      expect(pathOf(page)).toBe(path);
      await expect(
        page.getByRole('heading', { level: 1, name: heading })
      ).toBeVisible();
    }
  });

  test('keeps a filter in the URL across a reload and restores it on Back', async ({
    page,
  }) => {
    await page.goto(routes.catalog('lt'));

    // Apply "condition = new" through whichever filter surface this viewport
    // actually shows (sidebar on desktop, drawer on a phone).
    const form = await openFilterForm(page);
    await form.getByLabel(LT.filterCondition).selectOption('new');
    await form.getByRole('button', { name: LT.apply }).click();

    await expect(page).toHaveURL(/condition=new/);
    expect(queryParam(page, 'condition')).toBe('new');

    // A reload must not lose the selection — the URL is the state.
    await page.reload();
    expect(queryParam(page, 'condition')).toBe('new');

    const reopened = await openFilterForm(page);
    await expect(reopened.getByLabel(LT.filterCondition)).toHaveValue('new');

    // …and Back returns to the unfiltered catalog.
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`${routes.catalog('lt')}(\\?(?!.*condition=new).*)?$`)
    );
    expect(queryParam(page, 'condition')).toBeNull();
  });

  test('carries a category filter through as a query parameter', async ({ page }) => {
    await page.goto(routes.tires('lt'));

    const form = await openFilterForm(page);
    await form.getByLabel(LT.filterPriceFrom).fill('25');
    await form.getByRole('button', { name: LT.apply }).click();

    await expect(page).toHaveURL(/priceMin=25/);
    // The route still decides the category, so the path is unchanged.
    expect(pathOf(page)).toBe(routes.tires('lt'));

    await page.reload();
    expect(queryParam(page, 'priceMin')).toBe('25');
  });

  test('opens a listing from the catalog and shows its price and specs', async ({
    page,
  }) => {
    await page.goto(routes.catalog('lt'));

    const total = await countListings(page);
    test.skip(
      total === 0,
      'The catalog is empty on this environment, so there is no listing to open.'
    );

    const firstCard = listingCards(page).first();
    await firstCard.getByRole('link').first().click();

    await expect(page).toHaveURL(/\/lt\/skelbimas\//);

    // A price in euros…
    await expect(page.getByText(/€/).first()).toBeVisible();
    // …and the technical specification block.
    await expect(
      page.getByRole('heading', { name: LT.specsTitle })
    ).toBeVisible();
  });

  test('renders the not-found page for an unknown route', async ({ page }) => {
    const response = await page.goto('/lt/this-route-does-not-exist-000');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: LT.notFoundTitle })
    ).toBeVisible();
  });

  test('renders the 404 page in the language of the unknown URL, inside the site layout', async ({
    page,
  }) => {
    const cases = [
      { locale: 'lt', title: LT.notFoundTitle },
      { locale: 'ru', title: RU.notFoundTitle },
      { locale: 'en', title: EN.notFoundTitle },
    ] as const;

    for (const { locale, title } of cases) {
      const response = await page.goto(`/${locale}/this-route-does-not-exist-000`);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      // The site layout, not Next's bare built-in page.
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
      // The way out stays in the same language.
      await expect(
        page.getByRole('main').getByRole('link').first()
      ).toHaveAttribute('href', routes.home(locale));
    }
  });

  test('renders the 404 page in Russian for an unknown listing slug under /ru', async ({
    page,
  }) => {
    const response = await page.goto(routes.listing('ru', 'no-such-listing-00000000'));

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: RU.notFoundTitle })).toBeVisible();
  });

  test('renders the not-found page for an unknown listing slug', async ({ page }) => {
    const response = await page.goto(
      routes.listing('lt', 'no-such-listing-00000000')
    );

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: LT.notFoundTitle })
    ).toBeVisible();
  });
});
