import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for TAAXDOG E2E tests
 */
export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['html'], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Australian locale settings
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Context options
    contextOptions: {
      ignoreHTTPSErrors: !process.env.CI,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        env: {
          NODE_ENV: 'test',
          NEXTAUTH_URL: 'http://localhost:3000',
          // Add test database URL if needed
        },
      },

  /* Global setup */
  globalSetup: path.join(__dirname, 'playwright', 'config', 'global-setup.ts'),

  /* Global teardown */
  globalTeardown: path.join(__dirname, 'playwright', 'config', 'global-teardown.ts'),

  /* Folder for test artifacts */
  outputDir: 'test-results/',
});
