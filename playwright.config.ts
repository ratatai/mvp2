import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * End-to-end configuration.
 *
 * The mobile project runs at 375 px and a dedicated narrow project at 320 px,
 * because "works on a phone" is a hard requirement rather than a nice to have.
 */
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
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'narrow',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        isMobile: false,
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL === undefined
    ? {
        command: 'npm run start',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
