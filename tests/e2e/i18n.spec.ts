/**
 * Language switching.
 *
 * Three languages share one set of Lithuanian URL segments, so only the locale
 * prefix changes. The chosen language has to survive a reload (it is stored in
 * a cookie) and a page must never be half-translated.
 */

import { expect, test } from '@playwright/test';

import {
  EN,
  LT,
  pathOf,
  queryParam,
  routes,
  RU,
  switchLanguage,
} from './helpers';

test.describe('locale switching', () => {
  test('switches LT to RU to EN on the same page', async ({ page }) => {
    await page.goto(routes.catalog('lt'));
    await expect(
      page.getByRole('heading', { level: 1, name: LT.catalogTitle })
    ).toBeVisible();

    await switchLanguage(page, 'lt', 'ru');
    expect(pathOf(page)).toBe(routes.catalog('ru'));
    await expect(
      page.getByRole('heading', { level: 1, name: RU.catalogTitle })
    ).toBeVisible();

    await switchLanguage(page, 'ru', 'en');
    expect(pathOf(page)).toBe(routes.catalog('en'));
    await expect(
      page.getByRole('heading', { level: 1, name: EN.catalogTitle })
    ).toBeVisible();

    // The document language follows the URL, which is what assistive
    // technology and search engines read.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('keeps the chosen language after a reload and on a prefix-less URL', async ({
    page,
  }) => {
    await page.goto(routes.catalog('lt'));
    await switchLanguage(page, 'lt', 'ru');

    await page.reload();
    expect(pathOf(page)).toBe(routes.catalog('ru'));
    await expect(
      page.getByRole('heading', { level: 1, name: RU.catalogTitle })
    ).toBeVisible();

    // The cookie is what makes a link without a locale prefix resolve to the
    // visitor's language rather than back to Lithuanian.
    await page.goto('/');
    await expect(page).toHaveURL(/\/ru(\/|$)/);
  });

  test('keeps the current filters when the language changes', async ({ page }) => {
    await page.goto(`${routes.tires('lt')}?priceMin=30&sort=price_asc`);

    await switchLanguage(page, 'lt', 'en');

    expect(pathOf(page)).toBe(routes.tires('en'));
    expect(queryParam(page, 'priceMin')).toBe('30');
    expect(queryParam(page, 'sort')).toBe('price_asc');
  });

  test('never mixes languages on the Russian pages', async ({ page }) => {
    await page.goto(routes.catalog('ru'));

    await expect(
      page.getByRole('heading', { level: 1, name: RU.catalogTitle })
    ).toBeVisible();

    // Lithuanian-only navigation strings must not appear anywhere in the
    // markup, visible or not.
    await expect(page.getByText(LT.navCreateListing, { exact: true })).toHaveCount(
      0
    );
    await expect(page.getByText(LT.navWheels, { exact: true })).toHaveCount(0);

    // …and the Russian ones must.
    await expect(
      page.getByText(RU.navCreateListing, { exact: true }).first()
    ).toBeAttached();
  });

  test('never mixes languages on the Lithuanian pages', async ({ page }) => {
    await page.goto(routes.catalog('lt'));

    await expect(page.getByText(RU.navCreateListing, { exact: true })).toHaveCount(
      0
    );
    await expect(page.getByText(EN.navCreateListing, { exact: true })).toHaveCount(
      0
    );
    await expect(
      page.getByText(LT.navCreateListing, { exact: true }).first()
    ).toBeAttached();
  });

  test('translates the category pages in every language', async ({ page }) => {
    const cases = [
      { path: routes.wheels('lt'), heading: LT.categoryWheels },
      { path: routes.wheels('ru'), heading: RU.categoryWheels },
      { path: routes.wheels('en'), heading: EN.categoryWheels },
    ] as const;

    for (const { path, heading } of cases) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: heading })
      ).toBeVisible();
    }
  });
});
