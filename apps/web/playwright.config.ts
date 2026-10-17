import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import {
  API_PORT,
  API_URL,
  RECORDINGS_DIR,
  RECORDINGS_MAX_BYTES,
  TEST_DATABASE_URL,
  WEB_PORT,
  WEB_URL,
} from './e2e/env';

const apiDir = join(__dirname, '..', 'api');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: WEB_URL,
    // Dates on the page are checked as text.
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // Installed Google Chrome: Playwright's bundled Chromium doesn't support
      // every OS (e.g. macOS 12). Install it with `playwright install chrome`.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      // The api against the e2e database, with its own recordings directory.
      command: 'pnpm exec prisma migrate deploy && pnpm exec nest start',
      cwd: apiDir,
      // Any HTTP answer (401 here) means it is up.
      url: `${API_URL}/meetings`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: 'web-e2e-secret',
        WEB_ORIGIN: WEB_URL,
        RECORDINGS_DIR,
        RECORDINGS_MAX_BYTES: String(RECORDINGS_MAX_BYTES),
      },
    },
    {
      // A separate distDir, because Next locks `.next` for one `next dev`.
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_RECORDINGS_MAX_BYTES: String(RECORDINGS_MAX_BYTES),
      },
    },
  ],
});
