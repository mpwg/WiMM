// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { callTypedState, stateFixtureFromV1 } from '../tests/contract-bindings/state-wasm.ts';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
if (process.argv.slice(2).some((argument) => argument !== '--node-only')) throw new Error('Verwendung: test-typed-command-wasm.mjs [--node-only]');
const root = resolve('test-results/contract-bindings-generation/wasm');
const wasm = await import(pathToFileURL(resolve(root, 'wimm_core_bindings.js')).href);
wasm.initSync({ module: await readFile(resolve(root, 'wimm_core_bindings_bg.wasm')) });
const cases = JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')).filter((scenario) => ['project', 'validate', 'reverse', 'calculate'].includes(scenario.method));
assert.equal(cases.length, 204);
let jsonRejections = 0;
for (const scenario of cases) {
  let request;
  try { request = stateFixtureFromV1(scenario.request); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    jsonRejections += 1;
    assert.deepEqual(scenario.expected, { contractVersion: 1, status: 'rejected', error: { code: 'INVALID_COMMAND', message: 'Der Fachbefehl ist ungültig.' } });
    continue;
  }
  assert.deepEqual(callTypedState(wasm, scenario.method, request), scenario.expected, scenario.name);
}
assert.equal(jsonRejections, 1);
const results = { runtime: 'tatsächliches typisiertes WASM/Node', catalogOracles: cases.length, wasmBoundaryCalls: cases.length - jsonRejections, malformedJsonBeforeObjectBoundary: jsonRejections };
await mkdir('test-results/typed-state-bindings',{recursive:true});
await writeFile('test-results/typed-state-bindings/wasm-results.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
if (!process.argv.includes('--node-only')) {
  const browser = await runWithWarningCheck('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/contract-bindings/config.ts']);
  if (browser !== 0) process.exit(browser);
}
