// SPDX-License-Identifier: AGPL-3.0-or-later
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', outputDir: '../../test-results/ux', forbidOnly: true, fullyParallel: true, timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [{ name: 'Chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'Firefox', use: { ...devices['Desktop Firefox'] } }, { name: 'WebKit', use: { ...devices['Desktop Safari'] } }],
  webServer: { command: 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: !process.env.CI }
});
