// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'browser.spec.ts', outputDir: '../../test-results/ar04/browser', forbidOnly: true,
  workers: 1, use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' } })),
  webServer: { command: 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4178 --strictPort', url: 'http://127.0.0.1:4178', reuseExistingServer: false }
});
