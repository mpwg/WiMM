// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runWithWarningCheck } from './run-with-warning-check.mjs';

const mode = process.argv[2] ?? '--check';
if (!['--write', '--check'].includes(mode) || process.argv.length > 4) throw new Error('Verwendung: generate-contract-bindings.mjs [--write|--check [VERZEICHNIS]]');
const expectedRoot = resolve(process.argv[3] ?? 'packages/contracts/generated/private-v2');
const staging = resolve('test-results/contract-bindings-generation');
const publicRoot = resolve(expectedRoot, '../public-v2');
const localRoot = resolve(expectedRoot, '../local-v2');
const extension = process.platform === 'win32' ? 'wimm_core_bindings.dll' : process.platform === 'darwin' ? 'libwimm_core_bindings.dylib' : 'libwimm_core_bindings.so';
async function run(args) {
  const code = await runWithWarningCheck('cargo', args);
  if (code !== 0) process.exit(code);
}
// Tsify-Customsections liegen neben Codegen-Items. Ein gemeinsames Codegen-Unit
// verhindert maschinenabhängige, vom Linker verworfene Teilmengen der Datentypen.
async function runWasm(args) {
  const flags = `${process.env.RUSTFLAGS ?? ''} -C codegen-units=1`.trim();
  const code = await runWithWarningCheck('cargo', args, {env:{...process.env,RUSTFLAGS:flags}});
  if(code!==0)process.exit(code);
}
await mkdir(staging, { recursive: true });
await run(['build', '--locked', '-p', 'wimm-core-bindings', '-p', 'wimm-ffi-bindgen', '-p', 'wimm-wasm-glue']);
for (const language of ['swift', 'kotlin']) {
  await run(['run', '--locked', '-p', 'wimm-ffi-bindgen', '--', 'generate', '--library', resolve('target/debug', extension), '--language', language, '--out-dir', resolve(staging, language), '--no-format']);
}
await runWasm(['build', '--locked', '-p', 'wimm-core-bindings', '--no-default-features', '--features', 'wasm', '--target', 'wasm32-unknown-unknown']);
await run(['run', '--locked', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/debug/wimm_core_bindings.wasm', resolve(staging, 'wasm')]);
await run(['run', '--locked', '-p', 'wimm-contract-schema', '--', '--write', resolve(staging, 'schema')]);
const files = ['swift/WiMMCore.swift', 'swift/WiMMCoreFFI.h', 'swift/WiMMCoreFFI.modulemap', 'swift/WiMMPrivateTypes.swift', 'swift/WiMMPrivateTypesFFI.h', 'swift/WiMMPrivateTypesFFI.modulemap', 'kotlin/org/wimm/core/wimm_core_bindings.kt', 'kotlin/org/wimm/privatecontracts/wimm_finance_types.kt', 'wasm/wimm_core_bindings.d.ts'];
const publicFiles = ['swift/WiMMPublicTypes.swift','swift/WiMMPublicTypesFFI.h','swift/WiMMPublicTypesFFI.modulemap','kotlin/org/wimm/publiccontracts/wimm_public_contracts.kt'];
await runWasm(['build','--locked','-p','wimm-public-contracts','--features','wasm-bindings','--target','wasm32-unknown-unknown']);
await run(['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/debug/wimm_public_contracts.wasm',resolve(staging,'public-wasm')]);
await run(['run','--locked','-p','wimm-contract-schema','--','--public','--write',resolve(staging,'public-schema')]);
const publicManifest=JSON.parse(await readFile(resolve(staging,'public-schema/manifest.json'),'utf8'));
publicFiles.push('wasm/wimm_public_contracts.d.ts',...publicManifest.files.map(name=>`schema/${name}`),'schema/manifest.json');
const publicStaging = (file) => file.startsWith('schema/') ? resolve(staging,'public-schema',file.slice(7)) : file.startsWith('wasm/') ? resolve(staging,'public-wasm',file.slice(5)) : resolve(staging,file);

const schemaManifest = JSON.parse(await readFile(resolve(staging, 'schema/manifest.json'), 'utf8'));
files.push(...schemaManifest.files.map((name) => `schema/${name}`), 'schema/manifest.json');
// Nur Editorformat normalisieren; Generatorhinweise und Sprachcode bleiben erhalten.
for (const file of [...files,...publicFiles]) {
  const path = publicFiles.includes(file) ? publicStaging(file) : resolve(staging, file);
  const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n*$/, '\n'));
}
await writeFile(resolve(staging,'public-generation.json'),JSON.stringify({bindingVersion:2,protocolVersion:1,scope:'public',files:publicFiles,generators:{uniffi:'0.32.2',wasmBindgen:'0.2.129',rustWasmCodegenUnits:1}},null,2)+'\n');
for(const file of [...publicFiles,'generation.json']) {
  const source=file==='generation.json'?resolve(staging,'public-generation.json'):publicStaging(file);
  const destination=resolve(publicRoot,file);
  if(mode==='--write'){await mkdir(dirname(destination),{recursive:true});await writeFile(destination,await readFile(source));}
  else {let actual;try{actual=await readFile(destination);}catch{throw new Error(`Generierter öffentlicher Vertrag fehlt: ${destination}`);}if(!actual.equals(await readFile(source)))throw new Error(`Vertragsdrift: ${destination}`);}
}
if(mode==='--check')await run(['run','--locked','-p','wimm-contract-schema','--','--public','--check',resolve(publicRoot,'schema')]);
const localFiles=['swift/WiMMLocalTypes.swift','swift/WiMMLocalTypesFFI.h','swift/WiMMLocalTypesFFI.modulemap','kotlin/org/wimm/localcontracts/wimm_local_contracts.kt'];
await runWasm(['build','--locked','-p','wimm-local-contracts','--features','wasm-bindings','--target','wasm32-unknown-unknown']);
await run(['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/debug/wimm_local_contracts.wasm',resolve(staging,'local-wasm')]);
await run(['run','--locked','-p','wimm-contract-schema','--','--local','--write',resolve(staging,'local-schema')]);
const localManifest=JSON.parse(await readFile(resolve(staging,'local-schema/manifest.json'),'utf8'));
localFiles.push('wasm/wimm_local_contracts.d.ts',...localManifest.files.map(name=>`schema/${name}`),'schema/manifest.json');
const localStaging=file=>file.startsWith('schema/')?resolve(staging,'local-schema',file.slice(7)):file.startsWith('wasm/')?resolve(staging,'local-wasm',file.slice(5)):resolve(staging,file);
for(const file of localFiles){const path=localStaging(file);const original=await readFile(path,'utf8');await writeFile(path,original.replace(/\r\n/g,'\n').replace(/[\t ]+$/gm,'').replace(/\n*$/,'\n'));}
await writeFile(resolve(staging,'local-generation.json'),JSON.stringify({bindingVersion:2,scope:'local',sourceScope:'vollständige vorhandene Snapshot-/Port-/Migrationsdaten; V1-Wireadapter',files:localFiles,generators:{uniffi:'0.32.2',wasmBindgen:'0.2.129',rustWasmCodegenUnits:1}},null,2)+'\n');
for(const file of [...localFiles,'generation.json']){
 const source=file==='generation.json'?resolve(staging,'local-generation.json'):localStaging(file);const destination=resolve(localRoot,file);
 if(mode==='--write'){await mkdir(dirname(destination),{recursive:true});await writeFile(destination,await readFile(source));}
 else{let actual;try{actual=await readFile(destination);}catch{throw new Error(`Generierter lokaler Vertrag fehlt: ${destination}`);}if(!actual.equals(await readFile(source)))throw new Error(`Vertragsdrift: ${destination}`);}
}
if(mode==='--check')await run(['run','--locked','-p','wimm-contract-schema','--','--local','--check',resolve(localRoot,'schema')]);
// Versionen kennzeichnen den erzeugten Abschnitt, keine abgeschlossene Gesamt-ABI.
await writeFile(resolve(staging, 'generation.json'), JSON.stringify({ bindingVersion: 2, domainSchemaVersion: 1, legacyBindingVersion: 1, scope: 'calculate, execute, reverse, project und validate nativ/WASM; private Modelle TS/Swift/Kotlin; vollständige private Engineaktionen', generators: { uniffi: '0.32.2', wasmBindgen: '0.2.129', rustWasmCodegenUnits: 1 }, files }, null, 2) + '\n');
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
if (mode === '--check') await run(['run', '--locked', '-p', 'wimm-contract-schema', '--', '--check', resolve(expectedRoot, 'schema')]);
console.log(mode === '--check' ? 'Generierte Sprachverträge ohne Umschreiben geprüft.' : 'Sprachverträge aus gesperrten Rust-Bindinggeneratoren erzeugt.');
