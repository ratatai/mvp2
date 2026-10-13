/**
 * Complete-wheel result matching against a populated, disposable local catalog.
 *
 * Needs tests/e2e/fixtures/wheel-results.sql loaded into a NEW local stack
 * (see tests/e2e/fixtures/README.md) and E2E_WHEEL_FIXTURE=loaded. Without
 * that flag every test is skipped, so the normal suite on an empty database
 * is unaffected. The spec is read-only: it never signs in and never writes;
 * the fixture is loaded outside the browser run.
 *
 * Complete wheels keep tyre and rim data in nested specs.tire / specs.rim, so
 * every query here must resolve through those halves. Assertions compare the
 * exact set of listing slugs rendered as cards, not counts or the URL alone.
 */

import { expect, test, type Page } from '@playwright/test';

import { listingCards, routes, type Locale } from './helpers';

test.skip(
  process.env['E2E_WHEEL_FIXTURE'] !== 'loaded',
  'Requires the complete-wheel fixture in a fresh local stack (E2E_WHEEL_FIXTURE=loaded).'
);

/** Public complete-wheel slugs from tests/e2e/fixtures/wheel-results.sql. */
const WHEEL = {
  etM10: 'e2e-wheel-et-m10',
  et0: 'e2e-wheel-et-0',
  et40: 'e2e-wheel-et-40',
  etM11: 'e2e-wheel-et-m11',
  et41: 'e2e-wheel-et-41',
  otherWidth: 'e2e-wheel-other-width',
  otherAspect: 'e2e-wheel-other-aspect',
  otherDiameter: 'e2e-wheel-other-diameter',
  otherPcd: 'e2e-wheel-other-pcd',
  otherCb: 'e2e-wheel-other-cb',
  wide355: 'e2e-wheel-wide-355',
} as const;

/**
 * Must never appear on the wheel route: non-public wheels, plus a plain tyre
 * and a plain rim whose flat specs would match the wheel query.
 */
const NEVER = [
  'e2e-wheel-hidden-draft',
  'e2e-wheel-hidden-pending',
  'e2e-decoy-tyre',
  'e2e-decoy-rim',
] as const;

const TYRE = 'width=225&aspectRatio=45&diameter=17';
const RIM = 'pcd=5x112&cb=57.1';
const TECH = `${TYRE}&${RIM}`;

const ET_ALL = [WHEEL.etM11, WHEEL.etM10, WHEEL.et0, WHEEL.et40, WHEEL.et41];
const ET_INSIDE = [WHEEL.etM10, WHEEL.et0, WHEEL.et40];

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
  for (const slug of NEVER) expect(shown).not.toContain(slug);
}

async function openWheels(page: Page, query: string, locale: Locale = 'lt'): Promise<void> {
  await page.goto(`${routes.wheels(locale)}${query === '' ? '' : `?${query}`}`);
}

test.describe('Complete-wheel results (populated local fixture)', () => {
  test('unfiltered wheel catalog shows only public wheels, no hidden rows or tyre/rim decoys', async ({
    page,
  }) => {
    await openWheels(page, '');
    await expectResults(page, Object.values(WHEEL));
  });

  test('tyre width/profile/diameter filter the nested tyre half only', async ({ page }) => {
    await openWheels(page, TYRE);
    await expectResults(page, [...ET_ALL, WHEEL.otherPcd, WHEEL.otherCb]);
  });

  test('rim PCD/CB filter the nested rim half only', async ({ page }) => {
    await openWheels(page, RIM);
    await expectResults(page, [
      ...ET_ALL,
      WHEEL.otherWidth,
      WHEEL.otherAspect,
      WHEEL.otherDiameter,
      WHEEL.wide355,
    ]);
  });

  test('tyre and rim fields combine: every one-field near-miss is excluded', async ({ page }) => {
    await openWheels(page, TECH);
    await expectResults(page, ET_ALL);
  });

  test('ET -10..40 is inclusive at both ends and combines with all technical fields', async ({
    page,
  }) => {
    await openWheels(page, `${TECH}&etMin=-10&etMax=40`);
    await expectResults(page, ET_INSIDE);
  });

  test('one-sided lower bound -10 (negative) excludes -11 and keeps 41', async ({ page }) => {
    await openWheels(page, `${TECH}&etMin=-10`);
    await expectResults(page, [WHEEL.etM10, WHEEL.et0, WHEEL.et40, WHEEL.et41]);
  });

  test('one-sided upper bound 0 keeps negatives and excludes 40/41', async ({ page }) => {
    await openWheels(page, `${TECH}&etMax=0`);
    await expectResults(page, [WHEEL.etM11, WHEEL.etM10, WHEEL.et0]);
  });

  test('single-value and reversed ET ranges', async ({ page }) => {
    await openWheels(page, `${TECH}&etMin=-10&etMax=-10`);
    await expectResults(page, [WHEEL.etM10]);

    await openWheels(page, `${TECH}&etMin=40&etMax=40`);
    await expectResults(page, [WHEEL.et40]);

    await openWheels(page, `${TECH}&etMin=40&etMax=-10`);
    await expectResults(page, ET_INSIDE);
  });

  test('a 355 mm tyre width is searchable (no 305 cap)', async ({ page }) => {
    await openWheels(page, 'width=355');
    await expectResults(page, [WHEEL.wide355]);

    await openWheels(page, `width=355&aspectRatio=25&diameter=22&${RIM}&etMin=30&etMax=30`);
    await expectResults(page, [WHEEL.wide355]);
  });

  test('the same keys give the same results in LT, RU and EN routes', async ({ page }) => {
    for (const locale of ['lt', 'ru', 'en'] as const) {
      await openWheels(page, `${TECH}&etMin=-10&etMax=40`, locale);
      await expectResults(page, ET_INSIDE);
    }
  });
});
