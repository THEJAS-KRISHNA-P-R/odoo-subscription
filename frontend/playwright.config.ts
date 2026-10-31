import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

const PREINSTALLED_CHROMIUM =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const executablePath = fs.existsSync(PREINSTALLED_CHROMIUM)
  ? PREINSTALLED_CHROMIUM
  : undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
