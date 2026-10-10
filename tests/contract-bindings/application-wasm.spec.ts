// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/application-wasm.js';
const catalog = JSON.parse(readFileSync('test-results/application-bindings/cases.json', 'utf8')) as { cases: { name: string; request: unknown }[]; expected: unknown[] };
test('Anwendungs-V2: derselbe positive und negative Rust-Katalog im tatsächlichen Chromium-WASM', async ({ page }) => {
  expect(catalog.cases).toHaveLength(387); expect(catalog.expected).toHaveLength(387);
  await page.goto(`/tests/application-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/wasm/wimm_core_bindings.js')}`)}`);
  await page.waitForFunction(() => window.applicationPreparationProbe !== undefined);
  for (const [index, scenario] of catalog.cases.entries()) {
    expect(await page.evaluate(request => window.applicationPreparationProbe(request), scenario.request), scenario.name).toEqual(catalog.expected[index]);
  }
});
