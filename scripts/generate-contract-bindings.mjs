// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runWithWarningCheck } from './run-with-warning-check.mjs';

const mode = process.argv[2] ?? '--check';
if (!['--write', '--check'].includes(mode) || process.argv.length > 4) throw new Error('Verwendung: generate-contract-bindings.mjs [--write|--check [VERZEICHNIS]]');
const expectedRoot = resolve(process.argv[3] ?? 'packages/contracts/generated/private-v2');
const staging = resolve('test-results/contract-bindings-generation');
const extension = process.platform === 'win32' ? 'wimm_core_bindings.dll' : process.platform === 'darwin' ? 'libwimm_core_bindings.dylib' : 'libwimm_core_bindings.so';
async function run(args) {
  const code = await runWithWarningCheck('cargo', args);
  if (code !== 0) process.exit(code);
}
await mkdir(staging, { recursive: true });
await run(['build', '--locked', '-p', 'wimm-core-bindings', '-p', 'wimm-ffi-bindgen', '-p', 'wimm-wasm-glue']);
for (const language of ['swift', 'kotlin']) {
  await run(['run', '--locked', '-p', 'wimm-ffi-bindgen', '--', 'generate', '--library', resolve('target/debug', extension), '--language', language, '--out-dir', resolve(staging, language), '--no-format']);
}
await run(['build', '--locked', '-p', 'wimm-core-bindings', '--no-default-features', '--features', 'wasm', '--target', 'wasm32-unknown-unknown']);
await run(['run', '--locked', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/debug/wimm_core_bindings.wasm', resolve(staging, 'wasm')]);
const files = ['swift/WiMMCore.swift', 'swift/WiMMCoreFFI.h', 'swift/WiMMCoreFFI.modulemap', 'swift/WiMMPrivateTypes.swift', 'swift/WiMMPrivateTypesFFI.h', 'swift/WiMMPrivateTypesFFI.modulemap', 'kotlin/org/wimm/core/wimm_core_bindings.kt', 'kotlin/org/wimm/privatecontracts/wimm_finance_types.kt', 'wasm/wimm_core_bindings.d.ts'];
// Nur Editorformat normalisieren; Generatorhinweise und Sprachcode bleiben erhalten.
for (const file of files) {
  const path = resolve(staging, file);
  const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n*$/, '\n'));
}
// Versionen kennzeichnen den erzeugten Abschnitt, keine abgeschlossene Gesamt-ABI.
await writeFile(resolve(staging, 'generation.json'), JSON.stringify({ bindingVersion: 2, domainSchemaVersion: 1, legacyBindingVersion: 1, scope: 'money.parse nativ/WASM; execute und vollständige private Modelle nativ; weitere V2-Aktionen offen', generators: { uniffi: '0.32.2', wasmBindgen: '0.2.129' }, files }, null, 2) + '\n');
for (const file of [...files, 'generation.json']) {
  const source = resolve(staging, file);
  const destination = resolve(expectedRoot, file);
  if (mode === '--write') {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(source));
  } else {
    let actual;
    try { actual = await readFile(destination); }
    catch { throw new Error(`Generierter Vertrag fehlt: ${destination}`); }
    if (!actual.equals(await readFile(source))) throw new Error(`Vertragsdrift: ${destination}`);
  }
}
console.log(mode === '--check' ? 'Generierte Sprachverträge ohne Umschreiben geprüft.' : 'Sprachverträge aus gesperrten Rust-Bindinggeneratoren erzeugt.');
