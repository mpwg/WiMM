// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  outputDir: '../../test-results/workspace', forbidOnly: true, testDir: '.', testMatch: '*.spec.ts', fullyParallel: true, timeout: 90_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [{ name: 'Web-Speicherintegration' }, { name: 'Desktop-Frontend-Speicherintegration' }],
  webServer: { command: 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: !process.env.CI }
});
