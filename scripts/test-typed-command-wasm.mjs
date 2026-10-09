// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { callTypedCommand, mutateCommandFixture } from '../tests/contract-bindings/command-wasm.ts';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
if (process.argv.slice(2).some((argument) => argument !== '--node-only')) throw new Error('Verwendung: test-typed-command-wasm.mjs [--node-only]');
const root = resolve('test-results/contract-bindings-generation/wasm');
const wasm = await import(pathToFileURL(resolve(root, 'wimm_core_bindings.js')).href);
wasm.initSync({ module: await readFile(resolve(root, 'wimm_core_bindings_bg.wasm')) });
const cases = JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')).filter((scenario) => scenario.method === 'execute');
assert.equal(cases.length, 176);
for (const scenario of cases) {
  const request = typeof scenario.request === 'string' ? JSON.parse(scenario.request) : structuredClone(scenario.request);
  request.contractVersion = 2;
  assert.deepEqual(callTypedCommand(wasm, request), scenario.expected, scenario.name);
}
const negative = JSON.parse(await readFile('crates/finance-bindings/tests/fixtures/command-v2-negative.json', 'utf8'));
assert.equal(negative.length, 7);
for (const scenario of negative) assert.deepEqual(callTypedCommand(wasm, mutateCommandFixture(scenario.request, scenario.mode)), scenario.expected, scenario.name);
const forms = JSON.parse(await readFile('crates/finance-bindings/tests/fixtures/command-v2-forms.json', 'utf8'));
assert.equal(forms.length, 8);
for (const scenario of forms) assert.deepEqual(callTypedCommand(wasm, scenario.request), scenario.expected, scenario.name);
const required = structuredClone(forms.find((scenario) => scenario.name.endsWith('missingCandidate')));
required.request.command.aggregates[0].rows[0].candidate = undefined;
assert.deepEqual(callTypedCommand(wasm, required.request), required.expected, 'Erforderliches nullable Kandidatenfeld darf nicht undefined sein.');
const cyclic = structuredClone(forms[0]);
delete cyclic.request.surprise;
cyclic.request.command.aggregates[0].self = cyclic.request;
assert.deepEqual(callTypedCommand(wasm, cyclic.request), cyclic.expected, 'Zyklische Objektgraphen sind keine JSON-Vertragsdaten.');
const results = { runtime: 'tatsächliches typisiertes WASM/Node', sharedCommandCases: cases.length, sharedNegativeCases: negative.length, formNegativeCases: forms.length, jsDataNegativeCases: 2 };
await writeFile('test-results/typed-command-bindings/wasm-results.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
if (!process.argv.includes('--node-only')) {
  const browser = await runWithWarningCheck('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/contract-bindings/config.ts']);
  if (browser !== 0) process.exit(browser);
}
