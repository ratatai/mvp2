/**
 * Mobile navigation drawer: keyboard and breakpoint behaviour.
 *
 * Read-only. Every test sets a 375 px viewport itself, so the drawer trigger
 * is visible whichever project runs the spec.
 */

import { expect, type Page, test } from '@playwright/test';

import { LT, routes } from './helpers';

const OPEN_MENU = 'Atidaryti meniu';
const CLOSE_MENU = 'Uždaryti meniu';

async function openDrawer(page: Page) {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto(routes.home('lt'));

  const trigger = page.getByRole('button', { name: OPEN_MENU });
  await trigger.click();

  const drawer = page.getByRole('dialog', { name: OPEN_MENU });
  await expect(drawer).toBeVisible();
  const close = drawer.getByRole('button', { name: CLOSE_MENU });
  await expect(close).toBeFocused();

  return { trigger, drawer, close };
}

test.describe('mobile navigation drawer', () => {
  test('Tab and Shift+Tab wrap inside the open drawer', async ({ page }) => {
    const { drawer, close } = await openDrawer(page);
    const cta = drawer.getByRole('link', { name: LT.navCreateListing });

    await page.keyboard.press('Shift+Tab');
    await expect(cta).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
  });

  test('Escape closes the drawer and returns focus to the trigger', async ({
    page,
  }) => {
    const { trigger, drawer } = await openDrawer(page);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('the close button closes the drawer and returns focus', async ({
    page,
  }) => {
    const { trigger, drawer, close } = await openDrawer(page);

    await close.click();
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('widening to 1024px closes the drawer and restores scrolling', async ({
    page,
  }) => {
    const { drawer } = await openDrawer(page);
    const overflow = () =>
      page.evaluate(() => document.body.style.overflow);
    expect(await overflow()).toBe('hidden');

    await page.setViewportSize({ width: 1024, height: 720 });
    await expect(drawer).toHaveCount(0);
    await expect.poll(overflow).toBe('');
  });
});
