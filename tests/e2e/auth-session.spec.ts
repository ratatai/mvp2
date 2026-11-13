/**
 * Authentication session gate, through the real UI.
 *
 * One pre-provisioned, confirmed synthetic user in the LOCAL stack:
 *   anonymous → protected page redirects to login (with `next`)
 *   → UI login lands on the protected page → survives one reload
 *   → UI logout → protected page redirects to login again.
 *
 * Skipped unless `E2E_EMAIL` and `E2E_PASSWORD` are set (the same synthetic
 * account variables as the seller lifecycle spec). Before any navigation it
 * refuses a non-synthetic address and a non-loopback Supabase URL. It never
 * creates a user, sends email, or prints the credentials.
 *
 * Desktop project only, serial: `signOut()` revokes the user's sessions
 * server-side, so running it once per viewport (or next to the lifecycle
 * spec in parallel) could sign another test out mid-flow. It writes nothing
 * except, at most, the user's own profile row via `ensureProfile`.
 */

import { expect, test, type Page } from '@playwright/test';

import { EN, LT, pathOf, routes, RU, type Locale } from './helpers';
import { checkLocalSupabaseUrl } from './local-supabase-guard';
import {
  isSyntheticE2eEmail,
  NON_SYNTHETIC_EMAIL_MESSAGE,
} from './synthetic-account';

const email = process.env.E2E_EMAIL ?? '';
const password = process.env.E2E_PASSWORD ?? '';
const hasCredentials = email.length > 0 && password.length > 0;

/** Strings from src/i18n/dictionaries/lt.json not already in helpers.ts. */
const LT_AUTH = {
  createTitle: 'Naujas skelbimas', // form.createTitle
  dashboardTitle: 'Mano paskyra', // dashboard.title
  logout: 'Atsijungti', // nav.logout
} as const;

/** The login URL the middleware builds for an anonymous protected request. */
function loginRedirectFor(locale: Locale, target: string): string {
  return `${routes.login(locale)}?next=${encodeURIComponent(target)}`;
}

/** Asserts the page is the login form, with `next` pointing at `target`. */
async function expectLoginRedirect(
  page: Page,
  locale: Locale,
  target: string,
  loginTitle: string
): Promise<void> {
  expect(pathOf(page)).toBe(routes.login(locale));
  expect(new URL(page.url()).searchParams.get('next')).toBe(target);
  await expect(page.getByRole('heading', { name: loginTitle })).toBeVisible();
}

test.describe('anonymous protected route redirect keeps the locale', () => {
  // Read-only and session-free, so it may run in every project.
  for (const { locale, loginTitle } of [
    { locale: 'ru', loginTitle: RU.loginTitle },
    { locale: 'en', loginTitle: EN.loginTitle },
  ] as const) {
    test(`${locale}: new-listing page redirects to the ${locale} login`, async ({
      page,
    }) => {
      const target = routes.createListing(locale);
      await page.goto(target);
      await expectLoginRedirect(page, locale, target, loginTitle);
    });
  }
});

test.describe('synthetic user login and logout (LT)', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !hasCredentials,
    'E2E_EMAIL and E2E_PASSWORD are not set; the auth session gate needs a synthetic local user.'
  );

  test('protected page access follows the session', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Runs once: logout revokes the shared account sessions.'
    );

    // Guards first, before any browser navigation or network request.
    expect(isSyntheticE2eEmail(email), NON_SYNTHETIC_EMAIL_MESSAGE).toBe(true);
    expect(
      checkLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL).ok,
      'NEXT_PUBLIC_SUPABASE_URL must be a loopback URL.'
    ).toBe(true);

    const target = routes.createListing('lt');
    const createHeading = page.getByRole('heading', {
      name: LT_AUTH.createTitle,
      level: 1,
    });

    await test.step('anonymous visit is redirected to login', async () => {
      await page.goto(target);
      await expectLoginRedirect(page, 'lt', target, LT.loginTitle);
      await expect(createHeading).toHaveCount(0);
    });

    await test.step('UI login returns to the protected page', async () => {
      await page.getByLabel(LT.email).fill(email);
      await page.getByLabel(LT.password).fill(password);
      await page.getByRole('button', { name: LT.loginSubmit }).click();

      await expect(page).toHaveURL((url) => url.pathname === target);
      await expect(createHeading).toBeVisible();
    });

    await test.step('session survives one reload', async () => {
      await page.reload();
      expect(pathOf(page)).toBe(target);
      await expect(createHeading).toBeVisible();
    });

    await test.step('UI logout from the account page', async () => {
      await page.goto(routes.dashboard('lt'));
      await expect(
        page.getByRole('heading', { name: LT_AUTH.dashboardTitle, level: 1 })
      ).toBeVisible();

      await page
        .getByRole('main')
        .getByRole('button', { name: LT_AUTH.logout, exact: true })
        .click();

      // signOutAction redirects to the locale home.
      await expect(page).toHaveURL((url) => url.pathname === routes.home('lt'));
    });

    await test.step('protected page is denied again after logout', async () => {
      await page.goto(target);
      await expect(page).toHaveURL(
        (url) => `${url.pathname}${url.search}` === loginRedirectFor('lt', target)
      );
      await expectLoginRedirect(page, 'lt', target, LT.loginTitle);
      await expect(createHeading).toHaveCount(0);
    });
  });
});
