// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'money-v2.spec.ts', outputDir: '../../test-results/contract-bindings-generation/browser', forbidOnly: true,
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: !process.env.CI }
});
