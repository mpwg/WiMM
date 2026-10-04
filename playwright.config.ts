// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: true,
  testDir: './tests/ui',
  fullyParallel: true,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'Chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.WIMM_BUILD === '1'
      ? 'pnpm --filter @wimm/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort'
      : 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI && process.env.WIMM_BUILD !== '1'
  }
});
