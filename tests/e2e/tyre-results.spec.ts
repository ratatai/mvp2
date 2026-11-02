/**
 * Plain tyre result matching against a populated, disposable local catalog.
 *
 * Needs tests/e2e/fixtures/tyre-results.sql loaded into a NEW local stack
 * (see tests/e2e/fixtures/README.md) and E2E_TYRE_FIXTURE=loaded. Without
 * that flag every test is skipped, so the normal suite on an empty database
 * is unaffected. The spec is read-only: it never signs in and never writes;
 * the fixture is loaded outside the browser run.
 *
 * Assertions compare the exact set of listing slugs rendered as cards, not
 * counts or the URL alone.
 */

import { expect, test, type Page } from '@playwright/test';

import { listingCards, routes, type Locale } from './helpers';

test.skip(
  process.env['E2E_TYRE_FIXTURE'] !== 'loaded',
  'Requires the tyre fixture in a fresh local stack (E2E_TYRE_FIXTURE=loaded).'
);

/** Public tyre slugs from tests/e2e/fixtures/tyre-results.sql. */
const TYRE = {
  summer: 'e2e-tyre-match-summer',
  winter: 'e2e-tyre-match-winter',
  allSeason: 'e2e-tyre-match-all-season',
  otherWidth: 'e2e-tyre-other-width',
  otherAspect: 'e2e-tyre-other-aspect',
  otherDiameter: 'e2e-tyre-other-diameter',
  wide355: 'e2e-tyre-wide-355',
  wide375: 'e2e-tyre-wide-375',
} as const;

/**
 * Must never appear on the tyre route: non-public tyres, plus a complete
 * wheel and a plain rim that would match the tyre query by size/diameter.
 */
const NEVER = [
  'e2e-tyre-hidden-draft',
  'e2e-tyre-hidden-sold',
  'e2e-tyre-hidden-archived',
  'e2e-tyre-hidden-pending',
  'e2e-tyre-hidden-rejected',
  'e2e-decoy-wheel',
  'e2e-decoy-rim',
] as const;

const SIZE = 'width=205&aspectRatio=55&diameter=16';
const MATCHES = [TYRE.summer, TYRE.winter, TYRE.allSeason];

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

async function openTyres(page: Page, query: string, locale: Locale = 'lt'): Promise<void> {
  await page.goto(`${routes.tires(locale)}${query === '' ? '' : `?${query}`}`);
}

/** `q` value for a free-text tyre size, URL-encoded. */
function q(text: string): string {
  return `q=${encodeURIComponent(text)}`;
}

test.describe('Plain tyre results (populated local fixture)', () => {
  test('unfiltered tyre catalog shows only public tyres, no hidden rows or wheel/rim decoys', async ({
    page,
  }) => {
    await openTyres(page, '');
    await expectResults(page, Object.values(TYRE));
  });

  test('width, profile and diameter each filter on their own', async ({ page }) => {
    await openTyres(page, 'width=205');
    await expectResults(page, [...MATCHES, TYRE.otherAspect, TYRE.otherDiameter]);

    await openTyres(page, 'aspectRatio=55');
    await expectResults(page, [...MATCHES, TYRE.otherWidth, TYRE.otherDiameter]);

    // The plain rim decoy is R16 too; the category keeps it out.
    await openTyres(page, 'diameter=16');
    await expectResults(page, [...MATCHES, TYRE.otherWidth, TYRE.otherAspect]);
  });

  test('width, profile and diameter combine: every one-field near-miss is excluded', async ({
    page,
  }) => {
    await openTyres(page, SIZE);
    await expectResults(page, MATCHES);
  });

  test('canonical season narrows the results, alone and with the size', async ({ page }) => {
    await openTyres(page, `${SIZE}&season=winter`);
    await expectResults(page, [TYRE.winter]);

    await openTyres(page, `${SIZE}&season=all_season`);
    await expectResults(page, [TYRE.allSeason]);

    await openTyres(page, 'season=winter');
    await expectResults(page, [TYRE.winter, TYRE.wide375]);
  });

  test('355 and 375 mm widths are searchable (no 305 cap)', async ({ page }) => {
    await openTyres(page, 'width=355');
    await expectResults(page, [TYRE.wide355]);

    await openTyres(page, 'width=375&aspectRatio=40&diameter=22');
    await expectResults(page, [TYRE.wide375]);
  });

  test('a typed tyre size in the free-text query is parsed into the size fields', async ({
    page,
  }) => {
    for (const text of ['205/55 R16', '205/55R16', '205 55 16', '205-55-16']) {
      await openTyres(page, q(text));
      await expectResults(page, MATCHES);
    }

    await openTyres(page, q('375/40 R22'));
    await expectResults(page, [TYRE.wide375]);
  });

  test('the same keys give the same results in LT, RU and EN routes', async ({ page }) => {
    for (const locale of ['lt', 'ru', 'en'] as const) {
      await openTyres(page, SIZE, locale);
      await expectResults(page, MATCHES);

      await openTyres(page, `${q('205/55 R16')}&season=winter`, locale);
      await expectResults(page, [TYRE.winter]);
    }
  });
});
