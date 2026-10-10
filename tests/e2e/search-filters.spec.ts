/**
 * Category-first search panel.
 *
 * Every category leads with its technical parameters; everything else sits in
 * a collapsed "Daugiau filtrų" section. These specs only read the catalog and
 * drive the filter form: they never sign in, never write data and never
 * depend on how many listings the database holds. All assertions are about
 * the form itself and the URL it produces.
 *
 * Labels are copied from src/i18n/dictionaries/lt.json (see helpers.ts for
 * why they are duplicated rather than imported).
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  LT,
  openFilterForm,
  pathOf,
  queryParam,
  routes,
} from './helpers';

const F = {
  width: 'Plotis (mm)',
  aspectRatio: 'Profilis (%)',
  diameter: 'Skersmuo R (coliai)',
  season: 'Sezonas',
  pcd: 'Tvirtinimas (PCD)',
  cb: 'Centrinė anga CB (mm)',
  etFrom: 'ET nuo (mm)',
  etTo: 'ET iki (mm)',
  rimWidth: 'Ratlankio plotis (J)',
  boltCount: 'Skylių skaičius',
  priceFrom: 'Kaina nuo',
  tireSection: 'Padangų parametrai',
  rimSection: 'Ratlankių parametrai',
  wheelTireSection: 'Padanga',
  wheelRimSection: 'Ratlankis',
  moreFilters: 'Daugiau filtrų',
} as const;

const NARROW_WIDTHS = [320, 375] as const;

/** The expand/collapse button of the secondary section, inside one form. */
function moreToggle(form: Locator): Locator {
  return form.getByRole('button', { name: F.moreFilters });
}

async function topOf(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  expect(box, 'the element has no layout box').not.toBeNull();
  return box?.y ?? 0;
}

/** Submits the form and waits until the URL reflects it. */
async function apply(form: Locator, page: Page, expected: RegExp): Promise<void> {
  await form.getByRole('button', { name: LT.apply }).click();
  await expect(page).toHaveURL(expected);
}

const CATEGORIES = [
  {
    name: 'tyres',
    path: routes.tires('lt'),
    legends: [F.tireSection],
    technical: [F.width, F.aspectRatio, F.diameter],
    secondary: [F.season, F.priceFrom],
  },
  {
    name: 'rims',
    path: routes.rims('lt'),
    legends: [F.rimSection],
    technical: [F.pcd, F.cb, F.diameter, F.etFrom, F.etTo],
    secondary: [F.rimWidth, F.boltCount, F.priceFrom],
  },
  {
    name: 'complete wheels',
    path: routes.wheels('lt'),
    legends: [F.wheelTireSection, F.wheelRimSection],
    technical: [
      F.width,
      F.aspectRatio,
      F.diameter,
      F.pcd,
      F.cb,
      F.etFrom,
      F.etTo,
      F.rimWidth,
      F.boltCount,
    ],
    secondary: [F.season, F.priceFrom],
  },
] as const;

test.describe('category-first filter layout', () => {
  for (const category of CATEGORIES) {
    test(`${category.name}: technical fields come before the collapsed secondary filters`, async ({
      page,
    }) => {
      await page.goto(category.path);
      const form = await openFilterForm(page);

      for (const legend of category.legends) {
        await expect(form.getByText(legend, { exact: true })).toBeVisible();
      }
      for (const label of category.technical) {
        await expect(form.getByLabel(label)).toBeVisible();
      }

      // Without an active secondary filter the section starts collapsed.
      const toggle = moreToggle(form);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      for (const label of category.secondary) {
        await expect(form.getByLabel(label)).toBeHidden();
      }

      const lastTechnical = form.getByLabel(category.technical.at(-1) ?? '');
      expect(await topOf(lastTechnical)).toBeLessThan(await topOf(toggle));

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      for (const label of category.secondary) {
        const field = form.getByLabel(label);
        await expect(field).toBeVisible();
        expect(await topOf(field)).toBeGreaterThan(await topOf(toggle));
      }
    });
  }

  test('complete wheels show one shared diameter field', async ({ page }) => {
    await page.goto(routes.wheels('lt'));
    const form = await openFilterForm(page);

    await expect(form.getByLabel(F.diameter)).toHaveCount(1);
  });
});

test.describe('ET range', () => {
  for (const { name, path } of [
    { name: 'rims', path: routes.rims('lt') },
    { name: 'complete wheels', path: routes.wheels('lt') },
  ] as const) {
    test(`${name}: ET from and to are separate optional bounds, negative allowed, and reset clears both`, async ({
      page,
    }) => {
      await page.goto(path);
      let form = await openFilterForm(page);

      const etFrom = () => form.getByLabel(F.etFrom);
      const etTo = () => form.getByLabel(F.etTo);
      await expect(etFrom()).toBeVisible();
      await expect(etTo()).toBeVisible();

      // Lower bound only, negative.
      await etFrom().fill('-20');
      await apply(form, page, /etMin=-20/);
      expect(pathOf(page)).toBe(path);
      expect(queryParam(page, 'etMax')).toBeNull();

      form = await openFilterForm(page);
      await expect(etFrom()).toHaveValue('-20');
      await expect(etTo()).toHaveValue('');

      // Add the upper bound; the lower one is kept.
      await etTo().fill('45');
      await apply(form, page, /etMax=45/);
      expect(queryParam(page, 'etMin')).toBe('-20');

      // Reset clears both bounds from the URL and the form.
      form = await openFilterForm(page);
      await form.getByRole('button', { name: LT.reset }).click();
      await expect(page).not.toHaveURL(/etM(in|ax)=/);

      form = await openFilterForm(page);
      await expect(etFrom()).toHaveValue('');
      await expect(etTo()).toHaveValue('');
    });

    test(`${name}: an upper-only ET bound and a reversed range load from the URL`, async ({
      page,
    }) => {
      await page.goto(`${path}?etMax=-5`);
      let form = await openFilterForm(page);
      await expect(form.getByLabel(F.etFrom)).toHaveValue('');
      await expect(form.getByLabel(F.etTo)).toHaveValue('-5');

      // The parser swaps a reversed range rather than dropping it.
      await page.goto(`${path}?etMin=40&etMax=-10`);
      form = await openFilterForm(page);
      await expect(form.getByLabel(F.etFrom)).toHaveValue('-10');
      await expect(form.getByLabel(F.etTo)).toHaveValue('40');
    });
  }
});

test.describe('secondary filters across navigation', () => {
  test('rims: an active secondary filter is revealed on Back, and the toggle still works', async ({
    page,
  }) => {
    await page.goto(routes.rims('lt'));
    let form = await openFilterForm(page);
    let toggle = moreToggle(form);

    // Manual toggle between navigations.
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await form.getByLabel(F.boltCount).fill('5');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(form.getByLabel(F.boltCount)).toBeHidden();

    // Submitting a hidden secondary value opens the section.
    await apply(form, page, /boltCount=5/);
    form = await openFilterForm(page);
    toggle = moreToggle(form);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(form.getByLabel(F.boltCount)).toHaveValue('5');

    // Reset, then collapse by hand.
    await form.getByRole('button', { name: LT.reset }).click();
    await expect(page).not.toHaveURL(/boltCount=/);
    form = await openFilterForm(page);
    toggle = moreToggle(form);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Back restores boltCount=5: the section must not stay collapsed over it.
    await page.goBack();
    await expect(page).toHaveURL(/boltCount=5/);
    form = await openFilterForm(page);
    toggle = moreToggle(form);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(form.getByLabel(F.boltCount)).toBeVisible();
    await expect(form.getByLabel(F.boltCount)).toHaveValue('5');

    // Collapse again by hand; Forward to the reset URL keeps that choice.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.goForward();
    await expect(page).not.toHaveURL(/boltCount=/);
    form = await openFilterForm(page);
    toggle = moreToggle(form);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(form.getByLabel(F.boltCount)).toHaveValue('');
  });
});

test.describe('mobile filter drawer', () => {
  test('reaches and submits the tyre technical fields at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(routes.tires('lt'));

    await page.getByRole('button', { name: new RegExp(LT.filtersOpen) }).click();
    const drawer = page.getByRole('dialog', { name: LT.filtersTitle });
    await expect(drawer).toBeVisible();

    await drawer.getByLabel(F.width).fill('205');
    await drawer.getByLabel(F.aspectRatio).fill('55');
    await drawer.getByLabel(F.diameter).fill('16');
    await drawer.getByRole('button', { name: LT.apply }).click();

    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/width=205/);
    expect(pathOf(page)).toBe(routes.tires('lt'));
    expect(queryParam(page, 'aspectRatio')).toBe('55');
    expect(queryParam(page, 'diameter')).toBe('16');
  });

  test('reaches and submits the rim technical fields at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(routes.rims('lt'));

    await page.getByRole('button', { name: new RegExp(LT.filtersOpen) }).click();
    const drawer = page.getByRole('dialog', { name: LT.filtersTitle });
    await expect(drawer).toBeVisible();

    await drawer.getByLabel(F.pcd).fill('5x112');
    await drawer.getByLabel(F.cb).fill('57.1');
    await drawer.getByLabel(F.etFrom).fill('-10');
    const submit = drawer.getByRole('button', { name: LT.apply });
    await submit.scrollIntoViewIfNeeded();
    await submit.click();

    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/etMin=-10/);
    expect(queryParam(page, 'pcd')).toBe('5x112');
    expect(queryParam(page, 'cb')).toBe('57.1');
  });
});

test.describe('search panel fits narrow screens', () => {
  for (const width of NARROW_WIDTHS) {
    for (const { name, path } of CATEGORIES) {
      test(`${name}: page and expanded drawer fit ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto(path);
        await expectNoHorizontalOverflow(page);

        await page.getByRole('button', { name: new RegExp(LT.filtersOpen) }).click();
        const drawer = page.getByRole('dialog', { name: LT.filtersTitle });
        await expect(drawer).toBeVisible();
        await moreToggle(drawer).click();
        await expect(moreToggle(drawer)).toHaveAttribute('aria-expanded', 'true');

        await expectNoHorizontalOverflow(page);
      });
    }
  }
});
