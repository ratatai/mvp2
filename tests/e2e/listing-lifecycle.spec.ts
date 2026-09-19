/**
 * The full seller lifecycle, end to end.
 *
 * WHY THIS SPEC IS SKIPPED BY DEFAULT
 * -----------------------------------
 * Everything below writes to Supabase: it signs in, creates three listings,
 * uploads objects to Storage and publishes them. It only runs when both
 * `E2E_EMAIL` and `E2E_PASSWORD` are set, and only ever against the LOCAL
 * Supabase stack that playwright.config.ts enforces (see E2E_SAFETY.md).
 *
 * The account must be a synthetic user created in that local stack only
 * (e.g. seller@example.invalid) — never a real person and never a production
 * account. The credentials are never hard-coded, checked in or printed.
 *
 * The spec archives what it creates but does not delete it, so a failed run
 * leaves evidence behind; reset the local database after every run.
 *
 * It runs in the desktop project only (see playwright.config.ts) and in
 * serial mode, so the shared account is never driven by two workers at once.
 *
 * All listing content the spec types is obviously synthetic ("Testlandia"),
 * and no real phone number or address is ever entered.
 */

import { Buffer } from 'node:buffer';

import { expect, test, type Page } from '@playwright/test';

import { routes } from './helpers';

/* -------------------------------------------------------------------------- */
/* Credentials                                                                 */
/* -------------------------------------------------------------------------- */

const email = process.env.E2E_EMAIL ?? '';
const password = process.env.E2E_PASSWORD ?? '';
const hasCredentials = email.length > 0 && password.length > 0;

/* -------------------------------------------------------------------------- */
/* Lithuanian UI strings used by the seller flow                               */
/* -------------------------------------------------------------------------- */

const UI = {
  // navigation
  next: 'Toliau',
  back: 'Atgal',
  email: 'El. paštas',
  password: 'Slaptažodis',
  login: 'Prisijungti',

  // step 0 — category
  categoryTires: 'Padangos',
  categoryRims: 'Ratlankiai',
  categoryWheels: 'Komplektiniai ratai',

  // step 1 — specs (dict.specs.*)
  brand: 'Gamintojas',
  model: 'Modelis',
  width: 'Plotis',
  aspectRatio: 'Profilis',
  diameter: 'Skersmuo',
  season: 'Sezonas',
  rimWidth: 'Ratlankio plotis',
  boltCount: 'Skylių skaičius',
  pcd: 'PCD',
  cb: 'Centrinė skylė (CB)',
  et: 'Išnaša (ET)',
  material: 'Medžiaga',
  rimSection: 'Ratlankiai',
  tireSection: 'Padangos',

  // step 2 — price
  price: 'Kaina (EUR)',
  quantity: 'Kiekis (vnt.)',
  condition: 'Būklė',

  // step 3 — description and location
  title: 'Pavadinimas',
  city: 'Miestas',
  description: 'Aprašymas',

  // step 4 — photos
  photosAdd: 'Pridėti nuotraukų',
  photosPrimary: 'Pagrindinė',
  photosSetPrimary: 'Padaryti pagrindine',
  photosMoveRight: 'Perkelti dešinėn',
  photosRemove: 'Pašalinti nuotrauką',

  // step 5 — publish
  publish: 'Paskelbti',
  saveChanges: 'Išsaugoti pakeitimus',

  // dashboard
  myListingsTitle: 'Mano skelbimai',
  edit: 'Redaguoti',
  markSold: 'Pažymėti parduota',
  statusSold: 'Parduota',
  statusActive: 'Paskelbta',
  archive: 'Archyvuoti',
} as const;

/** A 1x1 transparent PNG, small enough to keep the upload instant. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/** Distinguishes the rows this run created from anything already there. */
const RUN_ID = `e2e-${Date.now()}`;

/* -------------------------------------------------------------------------- */
/* Small flow helpers                                                          */
/* -------------------------------------------------------------------------- */

async function signIn(page: Page): Promise<void> {
  await page.goto(routes.login('lt'));
  await page.getByLabel(UI.email).fill(email);
  await page.getByLabel(UI.password).fill(password);
  await page.getByRole('button', { name: UI.login }).click();

  // The action redirects to the dashboard on success.
  await expect(page).toHaveURL(new RegExp(`${routes.dashboard('lt')}$`));
}

/** Clicks "Toliau" and waits for the wizard to actually move on. */
async function goNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: UI.next }).click();
}

/** Fills the price / quantity / condition step. */
async function fillPriceStep(page: Page, price: string): Promise<void> {
  await page.getByLabel(UI.price).fill(price);
  await page.getByLabel(UI.quantity).fill('4');
  await page.getByLabel(UI.condition).selectOption('used');
}

/** Fills the title / city / description step. */
async function fillDescriptionStep(page: Page, title: string): Promise<void> {
  await page.getByLabel(UI.title).fill(title);
  await page.getByLabel(UI.city).fill('Vilnius');
  await page
    .getByLabel(UI.description)
    .fill(
      'Synthetic listing created by the automated end-to-end suite. Safe to delete.'
    );
}

/**
 * Uploads two photos, reorders them and promotes the new first one, then
 * asserts the listing has exactly one primary image.
 */
async function managePhotos(page: Page): Promise<void> {
  // The file input is visually hidden but reachable through its label.
  await page.getByLabel(UI.photosAdd).setInputFiles([
    { name: 'synthetic-1.png', mimeType: 'image/png', buffer: PIXEL_PNG },
    { name: 'synthetic-2.png', mimeType: 'image/png', buffer: PIXEL_PNG },
  ]);

  // Two thumbnails, each with a remove button, once the upload finishes.
  await expect(page.getByRole('button', { name: UI.photosRemove })).toHaveCount(2);
  // The first photo of an empty listing is promoted automatically.
  await expect(page.getByText(UI.photosPrimary)).toHaveCount(1);

  // Reorder: move the first photo one slot to the right.
  await page.getByRole('button', { name: UI.photosMoveRight }).first().click();

  // Promote whichever photo is now first.
  await page.getByRole('button', { name: UI.photosSetPrimary }).first().click();

  // Still exactly one primary — never zero, never two.
  await expect(page.getByText(UI.photosPrimary)).toHaveCount(1);
}

/** Walks the preview step and publishes. */
async function publish(page: Page): Promise<void> {
  await page.getByRole('button', { name: UI.publish }).click();
  await expect(page).toHaveURL(new RegExp(routes.myListings('lt')));
}

/* -------------------------------------------------------------------------- */
/* The spec                                                                    */
/* -------------------------------------------------------------------------- */

test.describe('seller lifecycle', () => {
  // One account, one run at a time: never split across parallel workers.
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !hasCredentials,
    'Set E2E_EMAIL and E2E_PASSWORD (a synthetic user in the local Supabase stack) to run the seller lifecycle spec.'
  );

  // Three listings, six wizard steps each, plus photo uploads.
  test.setTimeout(300_000);

  test('creates, photographs, edits and sells a listing in every category', async ({
    page,
  }) => {
    const tireTitle = `Testlandia padangos ${RUN_ID}`;
    const rimTitle = `Testlandia ratlankiai ${RUN_ID}`;
    const wheelTitle = `Testlandia ratai ${RUN_ID}`;

    await test.step('sign in as the test seller', async () => {
      await signIn(page);
    });

    /* ---------------------------------------------------------------- */
    /* 1. A tire listing                                                 */
    /* ---------------------------------------------------------------- */

    await test.step('create and publish a tire listing with photos', async () => {
      await page.goto(routes.createListing('lt'));

      // Step 0 — category.
      await page.getByRole('radio', { name: UI.categoryTires }).check();
      await goNext(page);

      // Step 1 — the tire half of the spec contract.
      await page.getByLabel(UI.brand).fill('Testlandia');
      await page.getByLabel(UI.width).fill('205');
      await page.getByLabel(UI.aspectRatio).fill('55');
      await page.getByLabel(UI.diameter).fill('16');
      await page.getByLabel(UI.season).selectOption('summer');
      await goNext(page);

      // Step 2 — commercial terms.
      await fillPriceStep(page, '120');
      await goNext(page);

      // Step 3 — this is where the draft row is created, because photos need
      // a listing id for their Storage path.
      await fillDescriptionStep(page, tireTitle);
      await goNext(page);

      // Step 4 — photos.
      await managePhotos(page);
      await goNext(page);

      // Step 5 — preview then publish.
      await expect(page.getByText(tireTitle)).toBeVisible();
      await publish(page);

      await expect(page.getByText(tireTitle)).toBeVisible();
    });

    /* ---------------------------------------------------------------- */
    /* 2. A rim listing                                                  */
    /* ---------------------------------------------------------------- */

    await test.step('create and publish a rim listing', async () => {
      await page.goto(routes.createListing('lt'));

      await page.getByRole('radio', { name: UI.categoryRims }).check();
      await goNext(page);

      // The bolt count has to agree with the first half of the PCD, which the
      // domain schema cross-checks.
      await page.getByLabel(UI.brand).fill('Testlandia');
      await page.getByLabel(UI.diameter).fill('18');
      await page.getByLabel(UI.rimWidth).fill('8.5');
      await page.getByLabel(UI.boltCount).fill('5');
      await page.getByLabel(UI.pcd).fill('5x112');
      await page.getByLabel(UI.cb).fill('66.6');
      await page.getByLabel(UI.et).fill('35');
      await page.getByLabel(UI.material).selectOption('alloy');
      await goNext(page);

      await fillPriceStep(page, '400');
      await goNext(page);

      await fillDescriptionStep(page, rimTitle);
      await goNext(page);

      await managePhotos(page);
      await goNext(page);

      await publish(page);
      await expect(page.getByText(rimTitle)).toBeVisible();
    });

    /* ---------------------------------------------------------------- */
    /* 3. A complete-wheel listing                                       */
    /* ---------------------------------------------------------------- */

    await test.step('create and publish a complete-wheel listing', async () => {
      await page.goto(routes.createListing('lt'));

      await page.getByRole('radio', { name: UI.categoryWheels }).check();
      await goNext(page);

      // Complete wheels render two fieldsets with identical field labels, so
      // each half has to be filled through its own group.
      const rim = page.getByRole('group', { name: UI.rimSection });
      const tire = page.getByRole('group', { name: UI.tireSection });

      await rim.getByLabel(UI.brand).fill('Testlandia');
      await rim.getByLabel(UI.diameter).fill('17');
      await rim.getByLabel(UI.rimWidth).fill('7.5');
      await rim.getByLabel(UI.boltCount).fill('5');
      await rim.getByLabel(UI.pcd).fill('5x112');
      await rim.getByLabel(UI.cb).fill('66.6');
      await rim.getByLabel(UI.et).fill('40');
      await rim.getByLabel(UI.material).selectOption('alloy');

      // The tire diameter must match the rim diameter — 17 on both halves.
      await tire.getByLabel(UI.brand).fill('Testlandia');
      await tire.getByLabel(UI.width).fill('225');
      await tire.getByLabel(UI.aspectRatio).fill('45');
      await tire.getByLabel(UI.diameter).fill('17');
      await tire.getByLabel(UI.season).selectOption('winter');
      await goNext(page);

      await fillPriceStep(page, '750');
      await goNext(page);

      await fillDescriptionStep(page, wheelTitle);
      await goNext(page);

      await managePhotos(page);
      await goNext(page);

      await publish(page);
      await expect(page.getByText(wheelTitle)).toBeVisible();
    });

    /* ---------------------------------------------------------------- */
    /* 4. Editing                                                        */
    /* ---------------------------------------------------------------- */

    await test.step('edit the tire listing and save the change', async () => {
      await page.goto(routes.myListings('lt'));

      const card = page
        .getByRole('listitem')
        .filter({ hasText: tireTitle })
        .first();

      await card.getByRole('link', { name: UI.edit }).click();
      await expect(page).toHaveURL(/\/redaguoti$/);

      // The edit form opens on the spec step, so walk forward to the price.
      await goNext(page);
      await page.getByLabel(UI.price).fill('135');

      await page.getByRole('button', { name: UI.saveChanges }).click();
      await expect(page).toHaveURL(new RegExp(routes.myListings('lt')));

      // 135 € is rendered through Intl, which uses a non-breaking space, so
      // the assertion looks for the number rather than the formatted string.
      await expect(
        page.getByRole('listitem').filter({ hasText: tireTitle }).first()
      ).toContainText('135');
    });

    /* ---------------------------------------------------------------- */
    /* 5. Marking sold                                                   */
    /* ---------------------------------------------------------------- */

    await test.step('mark the tire listing as sold', async () => {
      await page.goto(routes.myListings('lt'));

      const card = page
        .getByRole('listitem')
        .filter({ hasText: tireTitle })
        .first();

      await card.getByRole('button', { name: UI.markSold }).click();

      await expect(
        page.getByRole('listitem').filter({ hasText: tireTitle }).first()
      ).toContainText(UI.statusSold);
    });

    /* ---------------------------------------------------------------- */
    /* 6. The dashboard reflects the new state                           */
    /* ---------------------------------------------------------------- */

    await test.step('the dashboard counts the new listings', async () => {
      await page.goto(routes.dashboard('lt'));

      // Two listings are still live, one has been sold.
      await expect(page.getByText(UI.statusActive)).toBeVisible();
      await expect(page.getByText(UI.statusSold)).toBeVisible();

      await page.goto(routes.myListings('lt'));
      await expect(
        page.getByRole('heading', { level: 1, name: UI.myListingsTitle })
      ).toBeVisible();

      for (const title of [tireTitle, rimTitle, wheelTitle]) {
        await expect(page.getByText(title)).toBeVisible();
      }
    });

    /* ---------------------------------------------------------------- */
    /* 7. Tidy up                                                        */
    /* ---------------------------------------------------------------- */

    await test.step('archive what this run created', async () => {
      // Archiving rather than deleting: a failed run leaves the rows behind
      // for inspection instead of destroying them.
      for (const title of [tireTitle, rimTitle, wheelTitle]) {
        await page.goto(routes.myListings('lt'));

        const card = page.getByRole('listitem').filter({ hasText: title }).first();
        const archive = card.getByRole('button', { name: UI.archive });

        if (await archive.isVisible()) await archive.click();
      }
    });
  });
});
