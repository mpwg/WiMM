// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/public-wasm.js';
const catalog = JSON.parse(readFileSync('crates/public-contracts/tests/fixtures/public-forms.json', 'utf8')) as { cases: { name: string; action: 'operation' | 'roster'; request: unknown; valid: boolean }[] };
test('Unabhängiges öffentliches WASM: 42 gemeinsame Formorakel', async ({ page }) => {
  expect(catalog.cases).toHaveLength(42);
  await page.goto(`/tests/public-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/public-wasm/wimm_public_contracts.js')}`)}`);
  await page.waitForFunction(() => window.publicFormProbe !== undefined);
  for (const c of catalog.cases) {
    const result = await page.evaluate(({ action, request }) => window.publicFormProbe(action, request), c);
    if (c.valid) expect(result, c.name).toEqual({ contractVersion: 2, status: 'formValid' });
    else expect(result, c.name).toMatchObject({ contractVersion: 2, code: expect.stringMatching(/^(INVALID_ENVELOPE|UPDATE_REQUIRED)$/) });
  }
});
