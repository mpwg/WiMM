// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/local-wasm.js';
const catalog = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/migration-forms.json', 'utf8')) as { cases: { name: string; request: unknown; valid: boolean }[] };
test('Unabhängiges lokales WASM: 20 gemeinsame Migrationsformorakel ohne Write', async ({ page }) => {
  expect(catalog.cases).toHaveLength(20);
  await page.goto(`/tests/local-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')}`)}`);
  await page.waitForFunction(() => window.localMigrationProbe !== undefined);
  for (const c of catalog.cases) {
    const result = await page.evaluate(value => window.localMigrationProbe(value), c.request);
    if (c.valid) expect(result, c.name).toEqual({ contractVersion: 2, status: 'formValid' });
    else expect(result, c.name).toMatchObject({ contractVersion: 2, code: 'INVALID_LOCAL_CONTRACT' });
  }
});
