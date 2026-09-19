/**
 * Access control for the private areas.
 *
 * `/mano` (the seller dashboard) and `/naujas-skelbimas` (the create form)
 * are the only protected paths. An anonymous visitor must be sent to the
 * login page, and the address they were heading for has to be remembered in a
 * `next` parameter so signing in finishes the journey instead of dropping
 * them on the dashboard.
 */

import { expect, test } from '@playwright/test';

import { pathOf, queryParam, routes } from './helpers';

const PROTECTED_PATHS = (locale: 'lt' | 'ru' | 'en') =>
  [
    routes.createListing(locale),
    routes.dashboard(locale),
    routes.myListings(locale),
    routes.profile(locale),
  ] as const;

test.describe('anonymous visitors', () => {
  for (const target of PROTECTED_PATHS('lt')) {
    test(`are redirected from ${target} to the login page`, async ({ page }) => {
      await page.goto(target);

      expect(pathOf(page)).toBe(routes.login('lt'));
      expect(queryParam(page, 'next')).toBe(target);
    });
  }

  test('keep the query string of the page they were heading for', async ({
    page,
  }) => {
    const target = `${routes.myListings('lt')}?status=draft`;

    await page.goto(target);

    expect(pathOf(page)).toBe(routes.login('lt'));
    expect(queryParam(page, 'next')).toBe(target);
  });

  test('are redirected inside their own locale, not back to Lithuanian', async ({
    page,
  }) => {
    await page.goto(routes.dashboard('en'));

    expect(pathOf(page)).toBe(routes.login('en'));
    expect(queryParam(page, 'next')).toBe(routes.dashboard('en'));
  });

  test('can still reach every public page', async ({ page }) => {
    const publicPaths = [
      routes.home('lt'),
      routes.catalog('lt'),
      routes.tires('lt'),
      routes.login('lt'),
      routes.register('lt'),
      routes.passwordRecovery('lt'),
    ];

    for (const path of publicPaths) {
      const response = await page.goto(path);

      expect(response?.status(), `${path} should render`).toBeLessThan(400);
      expect(pathOf(page), `${path} should not redirect`).toBe(path);
    }
  });

  test('cannot reach an edit form for a listing they do not own', async ({
    page,
  }) => {
    // A syntactically valid but non-existent id: the route is under /mano, so
    // the middleware must stop it before the page ever runs a query.
    await page.goto(
      `${routes.myListings('lt')}/00000000-0000-4000-8000-000000000000/redaguoti`
    );

    expect(pathOf(page)).toBe(routes.login('lt'));
    expect(queryParam(page, 'next')).toContain('/redaguoti');
  });
});
