// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/command-wasm.js';
import { mutateCommandFixture } from './command-wasm.js';
const cases = (JSON.parse(readFileSync('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')) as readonly { name: string; method: string; request: unknown; expected: unknown }[]).filter((scenario) => scenario.method === 'execute');
test('Typisierter WASM-Befehl: alle unveränderten 176 Befehlsorakel', async ({ page }) => {
  expect(cases).toHaveLength(176);
  await page.goto(`/tests/command-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/wasm/wimm_core_bindings.js')}`)}`);
  await page.waitForFunction(() => window.typedCommandProbe !== undefined);
  for (const scenario of cases) {
    const request = (typeof scenario.request === 'string' ? JSON.parse(scenario.request) : structuredClone(scenario.request)) as Record<string, unknown>;
    request.contractVersion = 2;
    expect(await page.evaluate((value) => window.typedCommandProbe(value), request), scenario.name).toEqual(scenario.expected);
  }
  const negative = JSON.parse(readFileSync('crates/finance-bindings/tests/fixtures/command-v2-negative.json', 'utf8')) as readonly { name: string; mode: string; request: unknown; expected: unknown }[];
  expect(negative).toHaveLength(7);
  for (const scenario of negative) expect(await page.evaluate((value) => window.typedCommandProbe(value), mutateCommandFixture(scenario.request, scenario.mode)), scenario.name).toEqual(scenario.expected);
  const forms = JSON.parse(readFileSync('crates/finance-bindings/tests/fixtures/command-v2-forms.json', 'utf8')) as readonly { name: string; request: unknown; expected: unknown }[];
  expect(forms).toHaveLength(8);
  for (const scenario of forms) expect(await page.evaluate((value) => window.typedCommandProbe(value), scenario.request), scenario.name).toEqual(scenario.expected);
  const required = forms.find((scenario) => scenario.name.endsWith('missingCandidate'))!;
  expect(await page.evaluate((input) => {
    const value = input as { command: { aggregates: { rows: { candidate?: unknown }[] }[] } };
    value.command.aggregates[0]!.rows[0]!.candidate = undefined;
    return window.typedCommandProbe(value);
  }, required.request)).toEqual(required.expected);
  const cyclic = forms[0]!;
  expect(await page.evaluate((input) => {
    const value = input as { surprise?: unknown; command: { aggregates: Record<string, unknown>[] } };
    delete value.surprise;
    value.command.aggregates[0]!.self = value;
    return window.typedCommandProbe(value);
  }, cyclic.request)).toEqual(cyclic.expected);
});
