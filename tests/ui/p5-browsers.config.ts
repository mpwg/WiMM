// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test';
import web from '../../playwright.config.js';
import desktop from './desktop.config.js';
const nativeFrontend = process.env.WIMM_CLIENT === 'desktop';
export default defineConfig({
  ...(nativeFrontend ? desktop : web),
  testDir: '.', testMatch: 'p5.spec.ts',
  outputDir: `../../test-results/p5-browsers-${nativeFrontend ? 'desktop' : 'web'}`,
  workers: 2,
  projects: [
    // Firefox unterstützt keine Touchkontexte; dieselben Abläufe laufen per Tastatur.
    { name: 'Firefox-P5', grepInvert: /Touch/, use: { ...devices['Desktop Firefox'] } },
    { name: 'WebKit-P5', use: { ...devices['Desktop Safari'] } }
  ]
});
