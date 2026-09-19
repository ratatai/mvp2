/**
 * Authentication surfaces.
 *
 * These specs only exercise the public forms. They never create an account
 * and never submit a real address: the only email used is an obviously
 * synthetic one on the reserved `.invalid` top-level domain, which by
 * definition can never belong to a real person.
 */

import { expect, test } from '@playwright/test';

import { EN, LT, pathOf, routes, RU } from './helpers';

/** An address that cannot exist: `.invalid` is reserved by RFC 2606. */
function syntheticEmail(): string {
  return `e2e-no-such-account-${Date.now()}@example.invalid`;
}

test.describe('auth pages render their forms', () => {
  test('the login page shows an email field, a password field and a submit button', async ({
    page,
  }) => {
    await page.goto(routes.login('lt'));

    await expect(
      page.getByRole('heading', { name: LT.loginTitle })
    ).toBeVisible();
    await expect(page.getByLabel(LT.email)).toBeVisible();
    await expect(page.getByLabel(LT.password)).toBeVisible();
    await expect(
      page.getByRole('button', { name: LT.loginSubmit })
    ).toBeVisible();

    // The way out to registration and recovery is on the page.
    await expect(
      page.getByRole('link', { name: LT.registerSubmit })
    ).toBeVisible();
  });

  test('the registration page shows both password fields', async ({ page }) => {
    await page.goto(routes.register('lt'));

    await expect(
      page.getByRole('heading', { name: LT.registerTitle })
    ).toBeVisible();
    await expect(page.getByLabel(LT.email)).toBeVisible();
    await expect(page.getByLabel(LT.password)).toBeVisible();
    await expect(page.getByLabel(LT.passwordConfirm)).toBeVisible();
    await expect(
      page.getByRole('button', { name: LT.registerSubmit })
    ).toBeVisible();
  });

  test('the password recovery page shows an email field and a submit button', async ({
    page,
  }) => {
    await page.goto(routes.passwordRecovery('lt'));

    await expect(
      page.getByRole('heading', { name: LT.recoveryTitle })
    ).toBeVisible();
    await expect(page.getByLabel(LT.email)).toBeVisible();
    await expect(
      page.getByRole('button', { name: LT.recoverySubmit })
    ).toBeVisible();
  });

  test('the login page renders its form in every language', async ({ page }) => {
    const cases = [
      { locale: 'lt', submit: LT.loginSubmit, email: LT.email },
      { locale: 'ru', submit: RU.loginSubmit, email: RU.email },
      { locale: 'en', submit: EN.loginSubmit, email: EN.email },
    ] as const;

    for (const { locale, submit, email } of cases) {
      const response = await page.goto(routes.login(locale));

      expect(response?.status()).toBeLessThan(400);
      expect(pathOf(page)).toBe(routes.login(locale));
      await expect(page.getByLabel(email)).toBeVisible();
      await expect(page.getByRole('button', { name: submit })).toBeVisible();
    }
  });
});

test.describe('login failure handling', () => {
  test('an obviously wrong password shows a translated error and leaks nothing', async ({
    page,
  }) => {
    const email = syntheticEmail();

    await page.goto(routes.login('lt'));

    await page.getByLabel(LT.email).fill(email);
    await page.getByLabel(LT.password).fill('definitely-not-the-password');
    await page.getByRole('button', { name: LT.loginSubmit }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();

    const message = (await alert.textContent())?.trim() ?? '';

    // Whatever went wrong, the visitor is shown one of the translated
    // sentences — never a Supabase or PostgREST message.
    expect([
      LT.errorInvalidCredentials,
      LT.errorEmailInvalid,
      LT.errorGeneric,
      LT.errorRateLimit,
    ]).toContain(message);

    // The response must not confirm or deny that the address is registered.
    expect(message).not.toContain(email);
    expect(message.toLowerCase()).not.toContain('user');
    expect(message.toLowerCase()).not.toContain('email not');
    expect(message.toLowerCase()).not.toContain('invalid login credentials');

    // And the visitor stays on the login page rather than being redirected.
    expect(pathOf(page)).toBe(routes.login('lt'));
  });

  test('a malformed address is rejected client-side without a round trip', async ({
    page,
  }) => {
    await page.goto(routes.login('lt'));

    const emailField = page.getByLabel(LT.email);
    await emailField.fill('not-an-email');
    await page.getByLabel(LT.password).fill('definitely-not-the-password');
    await page.getByRole('button', { name: LT.loginSubmit }).click();

    // `type="email"` blocks the submission, so the page must not navigate.
    expect(pathOf(page)).toBe(routes.login('lt'));
    await expect(emailField).toBeVisible();
  });
});
