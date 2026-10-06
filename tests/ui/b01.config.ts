// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'p4-1-b01*.spec.ts', outputDir: '../../test-results/b01-browsers',
  forbidOnly: true, workers: 2, timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: (['chromium', 'firefox', 'webkit'] as const).map((browserName) => ({ name: browserName, use: { browserName } })),
  webServer: { command: 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false }
});
