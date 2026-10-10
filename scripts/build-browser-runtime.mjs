// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import {mkdir,readFile,writeFile,copyFile,cp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runWithWarningCheck} from './run-with-warning-check.mjs';
const mode=process.argv[2]??'--check';if(!['--check','--write'].includes(mode)||process.argv.length>4)throw new Error('Verwendung: build-browser-runtime.mjs [--check|--write [Signaturverzeichnis]]');
const target='packages/browser-adapters/generated/sqlite';const expected=resolve(process.argv[3]??target);const staging='test-results/dal04/runtime-build';await mkdir(staging,{recursive:true});await mkdir(target,{recursive:true});
const flags=`${process.env.RUSTFLAGS??''} -C codegen-units=1`.trim();
let status=await runWithWarningCheck('cargo',['build','--locked','--release','-p','wimm-browser-runtime','--target','wasm32-unknown-unknown'],{env:{...process.env,RUSTFLAGS:flags}});if(status!==0)process.exit(status);
status=await runWithWarningCheck('cargo',['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/release/wimm_browser_runtime.wasm',staging]);if(status!==0)process.exit(status);
for(const file of ['wimm_browser_runtime.d.ts','wimm_browser_runtime_bg.wasm.d.ts']){
 const signature=await readFile(`${staging}/${file}`,'utf8');
 if(mode==='--write'){await mkdir(expected,{recursive:true});await writeFile(`${expected}/${file}`,signature);}
 else if(await readFile(`${expected}/${file}`,'utf8')!==signature)throw new Error('Die versionierte Browser-WASM-Signatur ist verändert. Keine Datei wurde überschrieben.');
}
for(const file of ['wimm_browser_runtime.js','wimm_browser_runtime_bg.wasm'])await copyFile(`${staging}/${file}`,`${target}/${file}`);
await rm(`${target}/snippets`,{recursive:true,force:true});
await cp(`${staging}/snippets`,`${target}/snippets`,{recursive:true});
console.log('Aktueller Browser-Rust-DAL und typisierte Workerassets ohne Signaturdrift erzeugt.');
