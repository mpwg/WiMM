// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/core-bindings.js';
const cases = JSON.parse(readFileSync('test-results/core-bindings/cases.json', 'utf8')) as readonly { name: string; method: 'execute' | 'calculate' | 'roundtrip' | 'primitive' | 'validate' | 'project' | 'reverse' | 'cache'; request: unknown; expected: unknown }[];
for (const scenario of cases) {
  test(`Echtes Chromium/WASM: ${scenario.name}`, async ({ page }) => {
    await page.goto(`/tests/core-bindings.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/core-bindings/wasm/wimm_core_bindings.js')}`)}`);
    await page.waitForFunction(() => window.rustCoreProbe !== undefined);
    expect(await page.evaluate((value) => window.rustCoreProbe(value.method, value.request), scenario)).toEqual(scenario.expected);
  });
}
