// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
async function run(command, args) {
  const status = await runWithWarningCheck(command, args);
  if (status !== 0) process.exit(status);
}
const root = resolve('test-results/typed-state-bindings');
await mkdir(root, { recursive: true });
await run('cargo', ['test', '--locked', '-p', 'wimm-core-bindings', '--test', 'typed_state']);
await run('cargo', ['build', '--locked', '-p', 'wimm-core-bindings', '-p', 'wimm-ffi-bindgen', '--features', 'wimm-core-bindings/contract-probe']);
const libName = process.platform === 'win32' ? 'wimm_core_bindings.dll' : process.platform === 'darwin' ? 'libwimm_core_bindings.dylib' : 'libwimm_core_bindings.so';
for (const language of ['swift', 'kotlin']) {
  await run('cargo', ['run', '--locked', '-p', 'wimm-ffi-bindgen', '--', 'generate', '--library', resolve('target/debug', libName), '--language', language, '--out-dir', resolve(root, language), '--no-format']);
}
const jar = resolve('test-results/core-bindings/deps/jna-5.18.0.jar');
assert.equal(createHash('sha256').update(await readFile(jar)).digest('hex'), 'fe27c1e5e34a6aca84cb44da5f15271cd69069b1cf701ab5ba7320c57c55c439', 'Gesperrte JNA-Testabhängigkeit erforderlich; zuerst V2-Geldsprachlauf ausführen.');
await run(process.env.WIMM_KOTLINC ?? 'kotlinc', [resolve(root, 'kotlin/org/wimm/core/wimm_core_bindings.kt'), resolve(root, 'kotlin/org/wimm/privatecontracts/wimm_finance_types.kt'), 'tests/contract-bindings/state/Main.kt', '-classpath', jar, '-include-runtime', '-jvm-target', '21', '-Werror', '-d', resolve(root, 'probe.jar')]);
await run(process.env.WIMM_SWIFTC ?? 'swiftc', ['-warnings-as-errors', '-swift-version', '6', '-I', resolve(root, 'swift'), '-Xcc', `-fmodule-map-file=${resolve(root, 'swift/WiMMCoreFFI.modulemap')}`, '-Xcc', `-fmodule-map-file=${resolve(root, 'swift/WiMMPrivateTypesFFI.modulemap')}`, resolve(root, 'swift/WiMMCore.swift'), resolve(root, 'swift/WiMMPrivateTypes.swift'), 'tests/contract-bindings/state/main.swift', '-L', resolve('target/debug'), '-lwimm_core_bindings', '-Xlinker', '-rpath', '-Xlinker', resolve('target/debug'), '-o', resolve(root, 'swift-probe')]);
const cases = JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')).filter((scenario) => ['project', 'validate', 'reverse', 'calculate'].includes(scenario.method));
assert.equal(cases.length, 204);
const wire = (scenario) => typeof scenario.request === 'string' ? scenario.request : JSON.stringify(scenario.request);
const input = cases.map((scenario) => `${scenario.method}\t${wire(scenario)}`).join('\n') + '\n';
const results = [];
for (const [runtime, command, args] of [
  ['Swift/typisiertes UniFFI', resolve(root, 'swift-probe'), []],
  ['Kotlin/typisiertes UniFFI', process.env.WIMM_JAVA ?? 'java', [`-Djna.library.path=${resolve('target/debug')}`, '-cp', `${resolve(root, 'probe.jar')}${process.platform === 'win32' ? ';' : ':'}${jar}`, 'MainKt']]
]) {
  const result = spawnSync(command, args, { input, encoding: 'utf8' });
  assert.equal(result.status, 0, `${runtime}: ${result.stderr}`);
  assert.equal(result.stderr.trim(), '', `${runtime}: unerwartete Warnung/Diagnose`);
  const lines = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(lines.length, cases.length);
  cases.forEach((scenario, index) => assert.deepEqual(lines[index].output, scenario.expected, `${runtime}: ${scenario.name}`));
  const typed = { project: 0, validate: 0, reverse: 0, calculate: 0 };
  lines.forEach((line, index) => { if (line.typed) typed[cases[index].method] += 1; });
  assert.deepEqual(typed, { project: 41, validate: 46, reverse: 11, calculate: 80 });
  results.push({ runtime, passed: cases.length, actualTypedCalls: typed, formRejections: cases.length - typed.project - typed.validate - typed.reverse - typed.calculate });
}
await writeFile(resolve(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
