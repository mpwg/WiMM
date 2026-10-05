// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';
import base from './config.js';
import desktop from '../ui/desktop.config.js';
const nativeFrontend = process.env.WIMM_CLIENT === 'desktop';
export default defineConfig({
  ...(nativeFrontend ? desktop : base), testMatch: 'p5-zoom.spec.ts', testDir: '.',
  outputDir: `../../test-results/p5-zoom${nativeFrontend ? '-desktop' : ''}`,
  projects: [{ name: 'chromium' }], workers: 1, reporter: 'list'
});
