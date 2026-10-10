// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { callTypedMoney } from '../tests/contract-bindings/money-v2.ts';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const wasm = await import(pathToFileURL(resolve('test-results/contract-bindings-generation/wasm/wimm_core_bindings.js')).href);
wasm.initSync({ module: await readFile('test-results/contract-bindings-generation/wasm/wimm_core_bindings_bg.wasm') });
const cases = JSON.parse(await readFile('crates/finance-bindings/tests/fixtures/money-v2.json', 'utf8'));
for (const test of cases) assert.deepEqual(callTypedMoney(wasm, test.request), test.expected, test.name);
const badVersions = [2.5, 4294967298, -4294967294, NaN, Infinity, -Infinity];
for (const contractVersion of badVersions) {
  assert.deepEqual(callTypedMoney(wasm, { ...cases[4].request, contractVersion }), {
    contractVersion: 2, status: 'rejected', error: { code: 'UPDATE_REQUIRED', message: 'Der Enginevertrag wird nicht unterstützt.' }
  }, `Keine WASM-Versionstrunkierung: ${contractVersion}`);
}
// Fremde Requestobjekte dürfen nicht durch eine untypisierte JSON-Ersatzfunktion laufen.
assert.throws(() => wasm.calculate_money_v2(cases[4].request), /MoneyRequestV2/);
const nativeLanguages = process.argv[2] === '--native-languages' ? process.argv[3].split(',') : [];
if (process.argv.length > 2 && (process.argv.length !== 4 || nativeLanguages.some((language) => !['swift', 'kotlin'].includes(language)))) throw new Error('Verwendung: test-contract-bindings-v2.mjs [--native-languages swift,kotlin]');
async function run(command, args) {
  const code = await runWithWarningCheck(command, args);
  if (code !== 0) process.exit(code);
}
const nativeResults = [];
const staging = resolve('test-results/contract-bindings-generation');
const kotlinJar = resolve(staging, 'kotlin-probe.jar');
const jna = resolve('test-results/core-bindings/deps/jna-5.18.0.jar');
if (nativeLanguages.includes('kotlin')) {
  await mkdir(resolve('test-results/core-bindings/deps'), { recursive: true });
  let bytes;
  try { bytes = await readFile(jna); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch('https://repo.maven.apache.org/maven2/net/java/dev/jna/jna/5.18.0/jna-5.18.0.jar');
    if (!response.ok) throw new Error('Die gesperrte JNA-Testabhängigkeit ist nicht verfügbar.');
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== 'fe27c1e5e34a6aca84cb44da5f15271cd69069b1cf701ab5ba7320c57c55c439') throw new Error('Die JNA-Testabhängigkeit entspricht nicht dem geprüften Herkunftsstand.');
  await writeFile(jna, bytes);
  await run(process.env.WIMM_KOTLINC ?? 'kotlinc', [resolve(staging, 'kotlin/org/wimm/core/wimm_core_bindings.kt'), resolve(staging, 'kotlin/org/wimm/privatecontracts/wimm_finance_types.kt'), resolve(staging, 'kotlin/org/wimm/publiccontracts/wimm_public_contracts.kt'), resolve(staging, 'kotlin/org/wimm/localcontracts/wimm_local_contracts.kt'), resolve(staging, 'kotlin/org/wimm/application/wimm_client_application.kt'), 'tests/contract-bindings/Main.kt', '-classpath', jna, '-include-runtime', '-jvm-target', '21', '-Werror', '-d', kotlinJar]);
}
if (nativeLanguages.includes('swift')) {
  await run(process.env.WIMM_SWIFTC ?? 'swiftc', ['-warnings-as-errors', '-swift-version', '6', '-I', resolve(staging, 'swift'), '-Xcc', `-fmodule-map-file=${resolve(staging, 'swift/WiMMCoreFFI.modulemap')}`, '-Xcc', `-fmodule-map-file=${resolve(staging, 'swift/WiMMPrivateTypesFFI.modulemap')}`, '-Xcc', `-fmodule-map-file=${resolve(staging, 'swift/WiMMPublicTypesFFI.modulemap')}`, '-Xcc', `-fmodule-map-file=${resolve(staging, 'swift/WiMMLocalTypesFFI.modulemap')}`, '-Xcc', `-fmodule-map-file=${resolve(staging, 'swift/WiMMApplicationFFI.modulemap')}`, resolve(staging, 'swift/WiMMCore.swift'), resolve(staging, 'swift/WiMMPrivateTypes.swift'), resolve(staging, 'swift/WiMMPublicTypes.swift'), resolve(staging, 'swift/WiMMLocalTypes.swift'), resolve(staging, 'swift/WiMMApplication.swift'), 'tests/contract-bindings/main.swift', '-L', resolve('target/debug'), '-lwimm_core_bindings', '-Xlinker', '-rpath', '-Xlinker', resolve('target/debug'), '-o', resolve(staging, 'swift-probe')]);
}
const encode = (text) => Buffer.from(text, 'utf8').toString('base64');
const input = cases.map(({ request }) => [request.contractVersion, request.domainSchemaVersion, encode(request.spaceId), encode(request.text)].join('\t')).join('\n') + '\n';
for (const language of nativeLanguages) {
  const invocation = language === 'swift'
    ? [resolve(staging, 'swift-probe'), []]
    : [process.env.WIMM_JAVA ?? 'java', [`-Djna.library.path=${resolve('target/debug')}`, '-cp', `${kotlinJar}${process.platform === 'win32' ? ';' : ':'}${jna}`, 'MainKt']];
  const response = spawnSync(invocation[0], invocation[1], { input, encoding: 'utf8' });
  assert.equal(response.status, 0, `${language}: ${response.stderr}`);
  assert.equal(response.stderr.trim(), '', `${language}: unerwartete Warnung/Diagnose`);
  const lines = response.stdout.replace(/\r?\n$/, '').split(/\r?\n/);
  assert.equal(lines.length, cases.length);
  for (const [index, test] of cases.entries()) {
    const expected = test.expected;
    assert.equal(lines[index], [2, expected.status, expected.value ?? '', expected.error?.code ?? '', expected.error === undefined ? '' : encode(expected.error.message)].join('\t'), `${language}: ${test.name}`);
  }
  nativeResults.push({ runtime: `${language}/tatsächliches UniFFI`, sharedCases: cases.length });
}
const results = { runtime: 'tatsächliches WASM/Node', sharedCases: cases.length, wasmVersionCases: badVersions.length, foreignRequestRejected: true, nativeResults };
await writeFile('test-results/contract-bindings-generation/money-v2-results.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
const browserCode = await runWithWarningCheck('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/contract-bindings/config.ts']);
if (browserCode !== 0) process.exit(browserCode);
