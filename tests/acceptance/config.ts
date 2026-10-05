// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';
const desktop = process.env.WIMM_CLIENT === 'desktop';
const zoom = process.env.WIMM_REAL_ZOOM === '1';
const matrix = process.env.WIMM_MATRIX === '1' || zoom;
const port = zoom ? 4177 : matrix ? 4175 : desktop ? 1420 : 4173;
export default defineConfig({
  testDir: '.', testMatch: zoom ? 'zoom.spec.ts' : matrix ? ['matrix.spec.ts', 'performance.spec.ts'] : 'browsers.spec.ts',
  outputDir: `../../test-results/p4-6-${zoom ? 'zoom' : matrix ? 'matrix' : desktop ? 'desktop' : 'web'}`,
  forbidOnly: true, workers: 1, timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: `../../test-results/p4-6-${zoom ? 'zoom' : matrix ? 'matrix' : desktop ? 'desktop' : 'web'}.json` }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: (matrix ? ['chromium'] : ['chromium', 'firefox', 'webkit']).map((browserName) => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' } })),
  webServer: { command: `pnpm --filter @wimm/${desktop && !matrix ? 'desktop' : 'web'} exec vite ${matrix ? '' : 'preview'} --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false }
});
