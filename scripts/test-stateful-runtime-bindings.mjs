// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
const root=resolve('test-results/stateful-runtime');await mkdir(root,{recursive:true});
async function run(cmd,args,options={}){assert.equal(await runWithWarningCheck(cmd,args,options),0);}
const native=process.argv.includes('--native-languages');
assert.ok(process.argv.slice(2).every(arg=>arg==='--native-languages'));
let cases,expected;
const catalog=JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json','utf8'));const r=structuredClone(catalog.find(c=>c.name==='Buchungs-CAS F01 neue Ausgabe').request);
const context={profileId:'50000000-0000-4000-8000-000000000001',spaceId:r.spaceId,epoch:'50000000-0000-4000-8000-000000000003',profileRevision:1,sessionGeneration:1,generation:1};const snapshot={contractVersion:2,context,aggregates:r.aggregates};
const request=action=>({contractVersion:2,domainSchemaVersion:1,action});const operation=n=>({operationId:`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`,occurredAt:'2026-10-10T12:00:00Z',generatedIds:[]});
cases=[];
for(const mode of ['standalone','connected'])for(const fault of ['normal','lost','rollback','cancelled','lateScope','exception','badSnapshot','badReceipt','journalCorrupt','readException']){
 const actions=[request({actionType:'load'}),request({actionType:'execute',command:r.command,expectedRevisions:r.expectedRevisions,operation:r.context}),request({actionType:'resolve'}),request({actionType:'history',direction:'undo',operation:operation(201)}),request({actionType:'resolve'}),request({actionType:'history',direction:'redo',operation:operation(202)})];cases.push({name:`${mode}/${fault}`,mode,fault,snapshot,actions});
}
for(const source of catalog.filter(c=>c.method==='execute'&&c.expected.status==='changed')){
 for(const mode of ['standalone','connected']){
  const original=structuredClone(source.request);const context={...snapshot.context,spaceId:original.spaceId};
  cases.push({name:`${mode}/${source.name}`,mode,fault:'catalog',snapshot:{contractVersion:2,context,aggregates:original.aggregates},actions:[request({actionType:'load'}),request({actionType:'execute',command:original.command,expectedRevisions:original.expectedRevisions,operation:original.context}),request({actionType:'resolve'})],source});
 }
}
await run('cargo',['test','--locked','-p','wimm-core-bindings','--test','runtime_session']);
await run('cargo',['build','--locked','-p','wimm-core-bindings','--bin','wimm-stateful-probe','--features','contract-probe']);
const rustInput=cases.map(({snapshot,fault,mode,actions})=>JSON.stringify({snapshot,fault,mode,actions})).join('\n')+'\n';
const rust=spawnSync(resolve('target/debug/wimm-stateful-probe'),[],{input:rustInput,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(rust.status,0,rust.stderr);assert.equal(rust.stderr,'');expected=rust.stdout.trim().split(/\r?\n/).map(JSON.parse);assert.equal(expected.length,cases.length);
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addFormat('uint32',{type:'number',validate:n=>Number.isInteger(n)&&n>=0&&n<=4_294_967_295});
const eventSchema=ajv.compile(JSON.parse(await readFile('packages/contracts/generated/application-v2/schema/runtime-event.schema.json','utf8')));
const pageSchema=ajv.compile(JSON.parse(await readFile('packages/contracts/generated/application-v2/schema/runtime-page.schema.json','utf8')));
for(const trace of expected){for(const event of trace.events)assert.ok(eventSchema(event),JSON.stringify(eventSchema.errors));for(const page of trace.pages)assert.ok(pageSchema(page),JSON.stringify(pageSchema.errors));}
const wrongHeader=structuredClone(expected[0].events[0]);wrongHeader.contractVersion=1;assert.equal(eventSchema(wrongHeader),false);
const extraField=structuredClone(expected[0].events[0]);extraField.privateKey='synthetisch';assert.equal(eventSchema(extraField),false);
const commandKinds=new Set();
for(const [i,c]of cases.entries()){const out=expected[i];assert.equal(out.events.at(-1).result.status,'closed');assert.equal(out.events.at(-2).result.status,'closed');const first=out.events[1];if(c.fault==='catalog'&&first.result.status==='committed'){commandKinds.add(c.source.expected.changeSet.commandType);assert.equal(out.writes,1);for(const aggregate of c.source.expected.changeSet.aggregates)assert.deepEqual(out.pages.flatMap(page=>page.aggregates).find(a=>a.id===aggregate.id),aggregate,c.name);}if(c.fault==='normal'){assert.equal(first.result.status,'committed');assert.equal(first.canUndo,true);assert.equal(out.events[3].canRedo,true);assert.equal(out.events[5].canUndo,true);assert.equal(out.writes,3);}if(['lost','badReceipt'].includes(c.fault)){assert.equal(first.result.status,'unknown');assert.equal(first.canUndo,false);assert.equal(out.events[2].result.status,'committed');assert.equal(out.events[2].canUndo,true);assert.equal(out.writes,3);}if(c.fault==='lateScope'){assert.equal(first.result.status,'committed');assert.equal(first.result.current,false);assert.equal(out.page,null);assert.equal(out.writes,1);}if(['badSnapshot','journalCorrupt','readException'].includes(c.fault)){assert.equal(first.result.status,'readFailed');assert.equal(out.writes,0);}if(c.fault==='exception'){assert.equal(first.result.status,'unknown');assert.equal(out.writes,1);}if(['rollback','cancelled'].includes(c.fault)){assert.equal(first.result.status,'notCommitted');assert.equal(first.canUndo,false);assert.equal(out.writes,1);}}
assert.equal(commandKinds.size,22,'Alle Befehlsarten durch tatsächliche zustandsbehaftete Instanzen');
if(native){
await run('cargo',['build','--locked','-p','wimm-core-bindings','-p','wimm-ffi-bindgen','--features','wimm-core-bindings/contract-probe']);
const lib=process.platform==='win32'?'wimm_core_bindings.dll':process.platform==='darwin'?'libwimm_core_bindings.dylib':'libwimm_core_bindings.so';
for(const lang of ['swift','kotlin'])await run('cargo',['run','--locked','-p','wimm-ffi-bindgen','--','generate','--library',resolve('target/debug',lib),'--language',lang,'--out-dir',resolve(root,lang),'--no-format']);
const modules=['Core','PrivateTypes','PublicTypes','LocalTypes','Application'];
await run(process.env.WIMM_SWIFTC??'swiftc',['-warnings-as-errors','-swift-version','6','-I',resolve(root,'swift'),...modules.flatMap(name=>['-Xcc',`-fmodule-map-file=${resolve(root,`swift/WiMM${name}FFI.modulemap`)}`]),...modules.map(name=>resolve(root,`swift/WiMM${name}.swift`)),'tests/contract-bindings/stateful/main.swift','-L',resolve('target/debug'),'-lwimm_core_bindings','-Xlinker','-rpath','-Xlinker',resolve('target/debug'),'-o',resolve(root,'swift-probe')]);
const packages={core:'wimm_core_bindings',privatecontracts:'wimm_finance_types',publiccontracts:'wimm_public_contracts',localcontracts:'wimm_local_contracts',application:'wimm_client_application'};const jar=resolve('test-results/core-bindings/deps/jna-5.18.0.jar');
await run(process.env.WIMM_KOTLINC??'kotlinc',[...Object.entries(packages).map(([p,file])=>resolve(root,`kotlin/org/wimm/${p}/${file}.kt`)),'tests/contract-bindings/stateful/Main.kt','-classpath',jar,'-include-runtime','-jvm-target','21','-Werror','-d',resolve(root,'probe.jar')]);
const input=cases.map(c=>[JSON.stringify(c.snapshot),c.fault,c.mode,...c.actions.map(JSON.stringify)].join('\t')).join('\n')+'\n';
for(const [runtime,cmd,args]of [['Swift',resolve(root,'swift-probe'),[]],['Kotlin',process.env.WIMM_JAVA??'java',[`-Djna.library.path=${resolve('target/debug')}`,'-cp',`${resolve(root,'probe.jar')}${process.platform==='win32'?';':':'}${jar}`,'MainKt']]]){
 const result=spawnSync(cmd,args,{input,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');const values=result.stdout.trim().split(/\r?\n/).map(JSON.parse);assert.equal(values.length,cases.length);assert.deepEqual(values,expected,runtime);
 await writeFile(resolve(root,`${runtime.toLowerCase()}-results.json`),JSON.stringify(values,null,2)+'\n');
}
}
await writeFile(resolve(root,'cases.json'),JSON.stringify({cases,expected},null,2)+'\n');
await run('cargo',['build','--locked','-p','wimm-core-bindings','--no-default-features','--features','wasm,contract-probe','--target','wasm32-unknown-unknown'],{env:{...process.env,RUSTFLAGS:`${process.env.RUSTFLAGS??''} -C codegen-units=1`.trim()}});
await run('cargo',['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/debug/wimm_core_bindings.wasm',resolve(root,'wasm')]);
const wasm=await import(pathToFileURL(resolve(root,'wasm/wimm_core_bindings.js')).href);wasm.initSync({module:await readFile(resolve(root,'wasm/wimm_core_bindings_bg.wasm'))});
const {runStatefulCase}=await import('../tests/contract-bindings/stateful/wasm.mjs');const actual=cases.map(c=>runStatefulCase(wasm,c));assert.deepEqual(actual,expected,'WASM/Node');await writeFile(resolve(root,'wasm-results.json'),JSON.stringify(actual,null,2)+'\n');console.log('Zustandsbehaftete WASM/Node-Instanzen stimmen mit Swift/Kotlin überein.');

console.log(JSON.stringify({runtimes:native?['Rust','Swift','Kotlin','WASM/Node']:['Rust','WASM/Node'],sessions:cases.length,actions:cases.reduce((sum,c)=>sum+c.actions.length,0),commandKinds:commandKinds.size,actualSqliteAssertions:2,storageCallbacks:'synthetisch, kein Persistenzbeleg',crypto:'tatsächlicher Rust-/libsodium-Port'}));
