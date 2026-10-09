// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
const wasmOnly = process.argv.includes('--wasm-only');
const java = process.env.WIMM_JAVA ?? '/opt/homebrew/opt/openjdk@21/bin/java';
const swift = process.env.WIMM_SWIFTC ?? 'swiftc';
const kotlin = process.env.WIMM_KOTLINC ?? 'kotlinc';
const lib = resolve(`target/release/${process.platform === 'win32' ? 'wimm_core_bindings.dll' : process.platform === 'darwin' ? 'libwimm_core_bindings.dylib' : 'libwimm_core_bindings.so'}`);
async function run(command, args, options = {}) {
  const code = await runWithWarningCheck(command, args, options);
  if (code !== 0) process.exit(code);
}
await mkdir('test-results/core-bindings/wasm', { recursive: true });
await run('cargo', ['build', '--locked', '--release', '-p', 'wimm-core-probe', '-p', 'wimm-wasm-glue']);
await run('cargo', ['build', '--locked', '--release', '-p', 'wimm-core-bindings', '--no-default-features', '--features', 'wasm,contract-probe', '--target', 'wasm32-unknown-unknown']);
await run('cargo', ['run', '--locked', '--release', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/release/wimm_core_bindings.wasm', 'test-results/core-bindings/wasm']);
await run('pnpm', ['exec', 'tsx', 'tests/core-bindings/generate-cases.ts']);
if (!wasmOnly) {
  await run('cargo', ['build', '--locked', '--release', '-p', 'wimm-core-bindings', '-p', 'wimm-ffi-bindgen', '--features', 'wimm-core-bindings/contract-probe']);
  for (const language of ['swift', 'kotlin']) {
    await mkdir(`test-results/core-bindings/${language}`, { recursive: true });
    await run('cargo', ['run', '--locked', '--release', '-p', 'wimm-ffi-bindgen', '--', 'generate', '--library', lib, '--language', language, '--out-dir', `test-results/core-bindings/${language}`, '--no-format']);
  }
  const jar = 'test-results/core-bindings/deps/jna-5.18.0.jar';
  try { await access(jar); }
  catch {
    await mkdir('test-results/core-bindings/deps', { recursive: true });
    const response = await fetch('https://repo.maven.apache.org/maven2/net/java/dev/jna/jna/5.18.0/jna-5.18.0.jar');
    if (!response.ok) throw new Error('Die gesperrte JNA-Testabhängigkeit ist nicht verfügbar.');
    await writeFile(jar, new Uint8Array(await response.arrayBuffer()));
  }
  if (createHash('sha256').update(await readFile(jar)).digest('hex') !== 'fe27c1e5e34a6aca84cb44da5f15271cd69069b1cf701ab5ba7320c57c55c439') throw new Error('Die JNA-Testabhängigkeit entspricht nicht dem geprüften Herkunftsstand.');
  await run(swift, ['-warnings-as-errors', '-swift-version', '6', '-I', 'test-results/core-bindings/swift', '-Xcc', '-fmodule-map-file=test-results/core-bindings/swift/WiMMCoreFFI.modulemap', '-Xcc', '-fmodule-map-file=test-results/core-bindings/swift/WiMMPrivateTypesFFI.modulemap', 'test-results/core-bindings/swift/WiMMCore.swift', 'test-results/core-bindings/swift/WiMMPrivateTypes.swift', 'tests/core-bindings/main.swift', '-L', 'target/release', '-lwimm_core_bindings', '-Xlinker', '-rpath', '-Xlinker', resolve('target/release'), '-o', 'test-results/core-bindings/swift-probe']);
  await run(kotlin, ['test-results/core-bindings/kotlin/org/wimm/core/wimm_core_bindings.kt', 'test-results/core-bindings/kotlin/org/wimm/privatecontracts/wimm_finance_types.kt', 'tests/core-bindings/Main.kt', '-classpath', jar, '-include-runtime', '-jvm-target', '21', '-Werror', '-d', 'test-results/core-bindings/kotlin-probe.jar']);
}
await run('node', ['scripts/verify-core-bindings.mjs', ...(wasmOnly ? ['--wasm-only'] : [])], { env: { ...process.env, WIMM_JAVA: java } });
await run('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/core-bindings/config.ts']);
