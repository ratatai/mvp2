/**
 * Mobile layout guarantees.
 *
 * "Works on a phone" is a hard requirement here, so the two narrowest sizes
 * the project cares about (320 px and 375 px) are asserted explicitly rather
 * than left to whichever project happens to run the spec.
 */

import { expect, test } from '@playwright/test';

import {
  countListings,
  expectNoHorizontalOverflow,
  expectTapTarget,
  LT,
  listingCards,
  routes,
} from './helpers';

const NARROW_WIDTHS = [320, 375] as const;

test.describe('no horizontal overflow', () => {
  for (const width of NARROW_WIDTHS) {
    test(`home page fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(routes.home('lt'));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });

    test(`catalog fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(routes.catalog('lt'));
      await expect(
        page.getByRole('heading', { level: 1, name: LT.catalogTitle })
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });

    test(`a listing page fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(routes.catalog('lt'));

      const total = await countListings(page);
      test.skip(
        total === 0,
        'The catalog is empty on this environment, so there is no listing page to measure.'
      );

      await listingCards(page).first().getByRole('link').first().click();
      await expect(page).toHaveURL(/\/lt\/skelbimas\//);
      await expect(
        page.getByRole('heading', { name: LT.specsTitle })
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });
  }

  test('the filter drawer itself does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(routes.tires('lt'));

    await page.getByRole('button', { name: new RegExp(LT.filtersOpen) }).click();
    await expect(
      page.getByRole('dialog', { name: LT.filtersTitle })
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe('touch affordances', () => {
  test('the mobile filter trigger is visible on the catalog at 375px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(routes.catalog('lt'));

    const trigger = page.getByRole('button', { name: new RegExp(LT.filtersOpen) });

    await expect(trigger).toBeVisible();
    await expectTapTarget(trigger);
  });

  test('the main call to action is a 44x44 tap target at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(routes.home('lt'));

    await expectTapTarget(page.getByRole('link', { name: LT.heroCta }));
  });

  test('the menu button is a 44x44 tap target at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(routes.home('lt'));

    // The mobile navigation trigger is labelled, not icon-only, for
    // screen-reader users.
    await expectTapTarget(page.getByRole('button', { name: 'Atidaryti meniu' }));
  });
});
