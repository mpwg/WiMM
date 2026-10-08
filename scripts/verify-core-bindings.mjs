// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const cases = JSON.parse(await readFile('test-results/core-bindings/cases.json', 'utf8'));
const wasm = await import(pathToFileURL(resolve('test-results/core-bindings/wasm/wimm_core_bindings.js')).href);
wasm.initSync({ module: await readFile('test-results/core-bindings/wasm/wimm_core_bindings_bg.wasm') });
const wasmOnly = process.argv.includes('--wasm-only');
const tools = [
  ['Rust nativ', resolve('target/release/wimm-core-probe'), []],
  ...(!wasmOnly ? [
  ['Swift/UniFFI', resolve('test-results/core-bindings/swift-probe'), []],
  ['Kotlin/UniFFI', process.env.WIMM_JAVA ?? '/opt/homebrew/opt/openjdk@21/bin/java', [`-Djna.library.path=${resolve('target/release')}`, '-cp', `${resolve('test-results/core-bindings/kotlin-probe.jar')}:${resolve('test-results/core-bindings/deps/jna-5.18.0.jar')}`, 'MainKt']]
  ] : [])
];
const results = [];
for (const [name, command, args] of tools) {
  for (const method of ['execute', 'calculate', 'roundtrip', 'primitive']) {
    const selected = cases.filter((test) => test.method === method);
    const result = spawnSync(command, [...args, method], { input: selected.map((test) => JSON.stringify(test.request)).join('\n') + '\n', encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.equal(result.stderr.trim(), '', `${name}: unerwartete Warnung/Diagnose`);
    const responses = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(responses.length, selected.length);
    selected.forEach((test, index) => assert.deepEqual(responses[index], test.expected, `${name}: ${test.name}`));
  }
  results.push({ client: name, passed: cases.length });
}
for (const test of cases) assert.deepEqual(JSON.parse(test.method === 'execute' ? wasm.execute_json(JSON.stringify(test.request)) : test.method === 'primitive' ? wasm.primitive_json(JSON.stringify(test.request)) : test.method === 'calculate' ? wasm.calculate_json(JSON.stringify(test.request)) : wasm.roundtrip_json(JSON.stringify(test.request))), test.expected, `WASM: ${test.name}`);
results.push({ client: 'echtes WASM/Node', passed: cases.length });
await writeFile('test-results/core-bindings/results.json', `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results));
