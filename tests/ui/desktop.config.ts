// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  outputDir: '../../test-results/ui-desktop',
  forbidOnly: true,
  testDir: '.',
  testMatch: ['p4-1*.spec.ts', 'p4-2-1.spec.ts', 'p4-2-2.spec.ts', 'p4-2-3.spec.ts', 'p4-2-4.spec.ts', 'p4-2-5.spec.ts', 'p4-2-6.spec.ts', 'p4-2-7.spec.ts', 'p4-3*.spec.ts', 'p4-4*.spec.ts', 'p4-5*.spec.ts', 'p5*.spec.ts'],
  // PWA-Service-Worker sind ausschließlich Bestandteil des Webclients.
  testIgnore: ['p4-1-7.spec.ts', 'p5-offline.spec.ts'],
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'Chromium-Desktop-Frontend', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.WIMM_BUILD === '1'
      ? 'pnpm --filter @wimm/desktop exec vite preview --host 127.0.0.1 --port 1420 --strictPort'
      : 'pnpm --filter @wimm/desktop exec vite --host 127.0.0.1 --port 1420 --strictPort',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env.CI && process.env.WIMM_BUILD !== '1'
  }
});
