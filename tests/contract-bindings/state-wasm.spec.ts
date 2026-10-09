// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/command-wasm.js';
import { stateFixtureFromV1, type StateAction } from './state-wasm.js';
const cases = (JSON.parse(readFileSync('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')) as readonly { name: string; method: StateAction; request: unknown; expected: unknown }[]).filter((scenario) => ['project', 'validate', 'reverse', 'calculate'].includes(scenario.method));
test('Typisierte WASM-Bestandsaktionen: unveränderte 204 Orakel', async ({ page }) => {
  expect(cases).toHaveLength(204);
  await page.goto(`/tests/command-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/wasm/wimm_core_bindings.js')}`)}`);
  await page.waitForFunction(() => window.typedStateProbe !== undefined);
  let jsonRejections = 0;
  for (const scenario of cases) {
    let request: unknown;
    try { request = stateFixtureFromV1(scenario.request); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      jsonRejections += 1;
      expect(scenario.expected).toEqual({ contractVersion: 1, status: 'rejected', error: { code: 'INVALID_COMMAND', message: 'Der Fachbefehl ist ungültig.' } });
      continue;
    }
    expect(await page.evaluate(({ method, request }) => window.typedStateProbe(method, request), { method: scenario.method, request }), scenario.name).toEqual(scenario.expected);
  }
  expect(jsonRejections).toBe(1);
});
