import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { z } from 'zod';

// Load .env.e2e environment variables
config({ path: '.env.e2e' });
const APP_PORT = 5200;

const e2eEnvSchema = z.object({
  PLAYWRIGHT_APP_BASE_URL: z.url().default(`http://localhost:${APP_PORT}`),
  PLAYWRIGHT_USE_API_MOCK: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  PLAYWRIGHT_APP_PORT: z.coerce.number().default(APP_PORT),
});
const e2eEnv = e2eEnvSchema.parse(process.env);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL for `await page.goto('/')` */
    baseURL: e2eEnv.PLAYWRIGHT_APP_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Run local dev server before starting tests -only in local */
  ...(!process.env.CI && {
    webServer: {
      command: `pnpm dev --port ${e2eEnv.PLAYWRIGHT_APP_PORT} --mode e2e`,
      timeout: 20 * 1000,
      port: e2eEnv.PLAYWRIGHT_APP_PORT,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  }),
});
