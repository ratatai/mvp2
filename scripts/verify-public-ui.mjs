/** Read-only production UI smoke in an unconfigured environment, not DB E2E.
 * Build first without .env files or hosted configuration. Requires Chromium.
 * No account creation, form submissions, data fixtures or API mocks.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

for (const name of readdirSync('.')) {
  assert(!/^\.env(?:\.|$)/.test(name) || name === '.env.example', 'Refusing an environment file');
}
assert(!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'Run this public outage smoke without Supabase configuration');
const executablePath = process.env.VERIFY_CHROMIUM_PATH;
if (executablePath) assert(existsSync(executablePath), 'Chromium executable missing');
const base = 'http://127.0.0.1:3191';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3191'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});
let browser;
let checks = 0;
const pass = (name) => { checks++; console.log(`PASS ${name}`); };
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 30000);
    server.once('error', reject);
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Own server exited: ${code}`)); });
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Ready')) { clearTimeout(timeout); resolve(); }
    });
  });
  browser = await chromium.launch({ executablePath, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  const dictionaries = Object.fromEntries(['lt', 'ru', 'en'].map(locale => [locale,
    JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8'))]));
  for (const locale of ['lt', 'ru', 'en']) {
    const dict = dictionaries[locale];
    for (const suffix of ['missing-page', 'missing/deep/page', 'skelbimai/missing', 'skelbimai/padangos/missing', 'skelbimai/ratlankiai/missing', 'skelbimai/komplektiniai-ratai/missing']) {
      const path = `/${locale}/${suffix}`;
      const response = await page.goto(base + path);
      assert.equal(response.status(), 404, path);
      await expect(page.getByRole('heading', { level: 1, name: dict.errors.notFoundTitle, exact: true })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      pass(`localized browser 404: ${path}`);
    }
    for (const suffix of ['prisijungti', 'registracija', 'slaptazodzio-atkurimas']) {
      const response = await page.goto(`${base}/${locale}/${suffix}`);
      assert.equal(response.status(), 200);
      await expect(page.locator('main input[type="email"]')).toBeVisible();
      await expect(page.locator('main button[type="submit"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      pass(`public form: /${locale}/${suffix}`);
    }
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const suffix of ['', '/prisijungti']) {
        await page.goto(`${base}/${locale}${suffix}`);
        await expect(page.locator('main h1')).toBeVisible();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${locale} ${width}`);
        pass(`no overflow: ${locale}${suffix || '/'} at ${width}px`);
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 720 });
  const open = async () => {
    await page.goto(base + '/lt');
    const trigger = page.getByRole('button', { name: 'Atidaryti meniu', exact: true });
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Atidaryti meniu', exact: true });
    const close = drawer.getByRole('button', { name: 'Uždaryti meniu', exact: true });
    await expect(drawer).toBeVisible(); await expect(close).toBeFocused();
    return { trigger, drawer, close };
  };
  let d = await open();
  await page.keyboard.press('Shift+Tab');
  await expect(d.drawer.getByRole('link', { name: dictionaries.lt.nav.createListing, exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(d.close).toBeFocused(); pass('mobile menu: Tab wraps both ways');
  await page.keyboard.press('Escape'); await expect(d.drawer).toBeHidden(); await expect(d.trigger).toBeFocused(); pass('mobile menu: Escape and focus return');
  d = await open(); await d.close.click(); await expect(d.drawer).toBeHidden(); await expect(d.trigger).toBeFocused(); pass('mobile menu: close and focus return');
  d = await open(); assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.setViewportSize({ width: 1024, height: 720 }); await expect(d.drawer).toHaveCount(0);
  assert.equal(await page.evaluate(() => document.body.style.overflow), ''); pass('mobile menu: widening restores scrolling');
  console.log(JSON.stringify({ mode: 'public-ui-without-database', passed: checks, failed: 0, skipped: 0, browser: browser.version() }));
} finally {
  await browser?.close(); server.kill('SIGTERM');
}
