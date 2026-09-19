import { defineConfig, devices } from '@playwright/test';

import { e2eEnvironmentProblem } from './tests/e2e/local-supabase-guard';

/**
 * End-to-end configuration.
 *
 * Safe by default (see E2E_SAFETY.md):
 *   • the run stops here, before any server or test starts, unless the
 *     Supabase URL in the environment points at a local stack;
 *   • Playwright always builds and starts its own server with that
 *     environment and never attaches to one that is already running, which
 *     might have been built with the production .env.local;
 *   • the seller lifecycle spec, the only one that writes data, runs once, in
 *     the desktop project only.
 *
 * The mobile project runs at 375 px and a dedicated narrow project at 320 px,
 * because "works on a phone" is a hard requirement rather than a nice to have.
 */

const environmentProblem = e2eEnvironmentProblem(process.env);
if (environmentProblem !== null) {
  throw new Error(environmentProblem);
}

const E2E_PORT = 3100;
const baseURL = `http://127.0.0.1:${E2E_PORT}`;

/** Writes to the database and Storage, so it must not run once per viewport. */
const MUTATING_SPECS = /listing-lifecycle\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 1 : 0,
  workers: process.env.CI === 'true' ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'lt-LT',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: MUTATING_SPECS,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'narrow',
      testIgnore: MUTATING_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        isMobile: false,
      },
    },
  ],

  webServer: {
    // Rebuilt on every run: the variables from the environment take precedence
    // over .env.local, so the server can only ever know the local stack.
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${E2E_PORT}`,
    url: baseURL,
    // Fail if the port is taken rather than test an unknown server.
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_PUBLIC_SITE_URL: baseURL },
  },
});
