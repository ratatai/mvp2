/**
 * Rim ET result matching against a populated, disposable local catalog.
 *
 * Needs tests/e2e/fixtures/rim-et-results.sql loaded into a NEW local stack
 * (see tests/e2e/fixtures/README.md) and E2E_RIM_ET_FIXTURE=loaded. Without
 * that flag every test is skipped, so the normal suite on an empty database
 * is unaffected. The spec is read-only: it never signs in and never writes;
 * the fixture is loaded outside the browser run.
 *
 * Assertions compare the exact set of listing slugs rendered as cards, not
 * counts or the URL alone.
 */

import { expect, test, type Page } from '@playwright/test';

import { LT, listingCards, openFilterForm, queryParam, routes, type Locale } from './helpers';

test.skip(
  process.env['E2E_RIM_ET_FIXTURE'] !== 'loaded',
  'Requires the rim ET fixture in a fresh local stack (E2E_RIM_ET_FIXTURE=loaded).'
);

/** Slugs from tests/e2e/fixtures/rim-et-results.sql. */
const RIM = {
  etM10: 'e2e-rim-et-m10',
  et0: 'e2e-rim-et-0',
  et40: 'e2e-rim-et-40',
  etM11: 'e2e-rim-et-m11',
  et41: 'e2e-rim-et-41',
  otherPcd: 'e2e-rim-other-pcd',
  otherCb: 'e2e-rim-other-cb',
  otherDiameter: 'e2e-rim-other-diameter',
} as const;

const HIDDEN = [
  'e2e-rim-hidden-draft',
  'e2e-rim-hidden-sold',
  'e2e-rim-hidden-archived',
  'e2e-rim-hidden-pending',
  'e2e-rim-hidden-rejected',
] as const;

const TECH = 'pcd=5x112&cb=57.1&diameter=17';

/** Slugs of every rendered listing card, sorted. */
async function cardSlugs(page: Page): Promise<string[]> {
  const hrefs = await listingCards(page)
    .locator('a[href*="/skelbimas/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  return [...new Set(hrefs.map((href) => href.split('/skelbimas/')[1] ?? href))].sort();
}

async function expectResults(page: Page, expected: readonly string[]): Promise<void> {
  await expect.poll(() => cardSlugs(page)).toEqual([...expected].sort());
  const shown = await cardSlugs(page);
  for (const slug of HIDDEN) expect(shown).not.toContain(slug);
}

async function openRims(page: Page, query: string, locale: Locale = 'lt'): Promise<void> {
  await page.goto(`${routes.rims(locale)}${query === '' ? '' : `?${query}`}`);
}

test.describe('Rim ET results (populated local fixture)', () => {
  test('unfiltered rim catalog shows only public rims, never draft/sold/archived/pending/rejected', async ({
    page,
  }) => {
    await openRims(page, '');
    await expectResults(page, Object.values(RIM));
  });

  test('PCD + CB + diameter without ET keeps every ET and drops other technical values', async ({
    page,
  }) => {
    await openRims(page, TECH);
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40, RIM.etM11, RIM.et41]);
  });

  test('ET -10..40 is inclusive at both ends and combines with PCD/CB/diameter', async ({
    page,
  }) => {
    await openRims(page, `${TECH}&etMin=-10&etMax=40`);
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40]);
  });

  test('ET range alone ignores technical fields; adding them narrows the same range', async ({
    page,
  }) => {
    await openRims(page, 'etMin=-10&etMax=40');
    await expectResults(page, [
      RIM.etM10,
      RIM.et0,
      RIM.et40,
      RIM.otherPcd,
      RIM.otherCb,
      RIM.otherDiameter,
    ]);

    await openRims(page, 'pcd=5x112&etMin=-10&etMax=40');
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40, RIM.otherCb, RIM.otherDiameter]);
  });

  test('one-sided lower bound -10 (negative) excludes -11 and keeps 41', async ({ page }) => {
    await openRims(page, `${TECH}&etMin=-10`);
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40, RIM.et41]);
  });

  test('one-sided upper bound 0 keeps negatives and excludes 40/41', async ({ page }) => {
    await openRims(page, `${TECH}&etMax=0`);
    await expectResults(page, [RIM.etM11, RIM.etM10, RIM.et0]);
  });

  test('single-value ranges match exactly at -10 and at 40', async ({ page }) => {
    await openRims(page, `${TECH}&etMin=-10&etMax=-10`);
    await expectResults(page, [RIM.etM10]);

    await openRims(page, `${TECH}&etMin=40&etMax=40`);
    await expectResults(page, [RIM.et40]);
  });

  test('reversed bounds are swapped by the parser and match -10..40', async ({ page }) => {
    await openRims(page, `${TECH}&etMin=40&etMax=-10`);
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40]);
  });

  test('the same keys give the same results in RU and EN routes', async ({ page }) => {
    for (const locale of ['ru', 'en'] as const) {
      await openRims(page, `${TECH}&etMin=-10&etMax=40`, locale);
      await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40]);
    }
  });

  test('submitting ET from/to through the LT form yields the inclusive result set', async ({
    page,
  }) => {
    await openRims(page, TECH);
    const form = await openFilterForm(page);
    await form.getByLabel('ET nuo (mm)').fill('-10');
    await form.getByLabel('ET iki (mm)').fill('40');
    await form.getByRole('button', { name: LT.apply }).click();
    await expect(page).toHaveURL(/etMax=40/);

    expect(queryParam(page, 'etMin')).toBe('-10');
    expect(queryParam(page, 'pcd')).toBe('5x112');
    expect(queryParam(page, 'cb')).toBe('57.1');
    expect(queryParam(page, 'diameter')).toBe('17');
    await expectResults(page, [RIM.etM10, RIM.et0, RIM.et40]);
  });
});
