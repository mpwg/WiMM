// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { MoneyFixtureRequest } from './money-v2.js';
import type {} from '../../apps/web/tests/money-v2.js';
const cases = JSON.parse(readFileSync('crates/finance-bindings/tests/fixtures/money-v2.json', 'utf8')) as readonly { name: string; request: MoneyFixtureRequest; expected: unknown }[];
test('Typisiertes V2-Binding: gemeinsames Geldorakel und keine Versionstrunkierung', async ({ page }) => {
  await page.goto(`/tests/money-v2.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/wasm/wimm_core_bindings.js')}`)}`);
  await page.waitForFunction(() => window.typedMoneyV2Probe !== undefined);
  for (const scenario of cases) expect(await page.evaluate((request) => window.typedMoneyV2Probe(request), scenario.request), scenario.name).toEqual(scenario.expected);
  const rejected = { contractVersion: 2, status: 'rejected', error: { code: 'UPDATE_REQUIRED', message: 'Der Enginevertrag wird nicht unterstützt.' } };
  for (const contractVersion of [2.5, 4294967298, -4294967294, NaN, Infinity, -Infinity]) {
    expect(await page.evaluate((request) => window.typedMoneyV2Probe(request), { ...cases[4]!.request, contractVersion })).toEqual(rejected);
  }
});
