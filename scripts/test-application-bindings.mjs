// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
const native=process.argv.includes('--native-languages');
assert.ok(process.argv.slice(2).every(arg=>arg==='--native-languages'));
const root=resolve('test-results/application-bindings');await mkdir(root,{recursive:true});
async function run(command,args){const status=await runWithWarningCheck(command,args);assert.equal(status,0);}
await run('cargo',['test','--locked','-p','wimm-client-application']);
await run('cargo',['build','--locked','-p','wimm-contract-schema']);
const catalog=JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json','utf8')).filter(c=>['execute','reverse'].includes(c.method));assert.equal(catalog.length,187);
const cases=[];
const id='50000000-0000-4000-8000-000000000001';
for(const c of catalog){
 let request=typeof c.request==='string'?JSON.parse(c.request):structuredClone(c.request);
 const contractVersion=request.contractVersion===1?2:request.contractVersion;const domainSchemaVersion=request.domainSchemaVersion;delete request.contractVersion;delete request.domainSchemaVersion;
 for(const mode of ['standalone','connected']){
  const started={profileId:id,spaceId:request.spaceId??id,epoch:'50000000-0000-4000-8000-000000000003',profileRevision:1,sessionGeneration:1,generation:1};
  cases.push({name:`${c.name}/${mode}`,source:c,request:{contractVersion,domainSchemaVersion,started,current:structuredClone(started),mode,action:{actionType:c.method==='execute'?'command':'reverse',request}}});
 }
}
const base=structuredClone(cases.find(c=>c.source.name==='Stammdaten account.save neu').request);
for(const field of ['profileId','spaceId','epoch','profileRevision','sessionGeneration','generation']){const request=structuredClone(base);request.current[field]=field.endsWith('Id')||field==='epoch'?'50000000-0000-4000-8000-000000000099':2;cases.push({name:`Scopewechsel ${field}`,request});}
for(const field of ['contractVersion','domainSchemaVersion']){const request=structuredClone(base);request[field]=99;cases.push({name:`Äußerer Header ${field}`,request});const inner=structuredClone(base);inner.action.request[field]=99;cases.push({name:`Unzulässiger redundanter Header ${field}`,request:inner});}
for(const field of ['extra','action','context']){const request=structuredClone(base);if(field==='extra')request.surprise=true;else if(field==='action')request.action.actionType='unknown';else request.current.generation=9_007_199_254_740_992;cases.push({name:`Ungültige Form ${field}`,request});}
const input=cases.map(c=>JSON.stringify(c.request)).join('\n')+'\n';
const probe=spawnSync(resolve('target/debug/wimm-contract-schema'),['--probe-application-v2'],{input,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(probe.status,0,probe.stderr);assert.equal(probe.stderr,'');
const expected=probe.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.equal(expected.length,cases.length);
await writeFile(resolve(root,'cases.json'),JSON.stringify({cases,expected})+'\n');
const wasmRoot=resolve('test-results/contract-bindings-generation/wasm');const wasm=await import(pathToFileURL(resolve(wasmRoot,'wimm_core_bindings.js')).href);wasm.initSync({module:await readFile(resolve(wasmRoot,'wimm_core_bindings_bg.wasm'))});
function call(request){try{return wasm.prepare_application_v2(request);}catch(e){assert.equal(e.contractVersion,2);assert.equal(e.code,'INVALID_COMMAND');return {formError:true};}}
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addFormat('uint32',{type:'number',validate:n=>Number.isInteger(n)&&n>=0&&n<=4_294_967_295});const schema=ajv.compile(JSON.parse(await readFile('packages/contracts/generated/application-v2/schema/application-preparation.schema.json','utf8')));
const kinds=new Set();let prepared=0;let formRejected=0;
for(const [i,c]of cases.entries()){
 const actual=call(c.request);assert.deepEqual(actual,expected[i],c.name);
 if(actual.formError){formRejected++;continue;}assert.ok(schema(actual),`${c.name}: ${JSON.stringify(schema.errors)}`);assert.equal(actual.contractVersion,2);
 if(actual.status==='prepared'){
  prepared++;assert.equal(actual.request.batch.outbox.length,c.request.mode==='connected'?1:0);
  assert.deepEqual(actual.request.batch.aggregates.map(({handle,...aggregate})=>{assert.equal(handle,aggregate.id);return aggregate;}),c.source.expected.changeSet.aggregates,c.name);
  assert.equal(actual.request.identity.operationId,c.source.expected.changeSet.operationId);
  if(c.source.method==='execute')kinds.add(c.source.expected.changeSet.commandType);
 }
}
assert.equal(kinds.size,22);assert.equal(prepared,140);
for(const mutate of [r=>{r.current.generation=Infinity;},r=>{r.current.self=r;},r=>{r.action.request.aggregates=new Map();}]){const request=structuredClone(base);mutate(request);assert.deepEqual(call(request),{formError:true});}
const runtimes=['Rust nativ','WASM/Node'];
if(native){
 await run('cargo',['build','--locked','-p','wimm-core-bindings','-p','wimm-ffi-bindgen','--features','wimm-core-bindings/contract-probe']);
 const lib=process.platform==='win32'?'wimm_core_bindings.dll':process.platform==='darwin'?'libwimm_core_bindings.dylib':'libwimm_core_bindings.so';
 for(const language of ['swift','kotlin'])await run('cargo',['run','--locked','-p','wimm-ffi-bindgen','--','generate','--library',resolve('target/debug',lib),'--language',language,'--out-dir',resolve(root,language),'--no-format']);
 const jar=resolve('test-results/core-bindings/deps/jna-5.18.0.jar');assert.equal(createHash('sha256').update(await readFile(jar)).digest('hex'),'fe27c1e5e34a6aca84cb44da5f15271cd69069b1cf701ab5ba7320c57c55c439');
 const modules=['Core','PrivateTypes','PublicTypes','LocalTypes','Application'];
 await run(process.env.WIMM_SWIFTC??'swiftc',['-warnings-as-errors','-swift-version','6','-I',resolve(root,'swift'),...modules.flatMap(name=>['-Xcc',`-fmodule-map-file=${resolve(root,`swift/WiMM${name}FFI.modulemap`)}`]),...modules.map(name=>resolve(root,`swift/WiMM${name}.swift`)),'tests/contract-bindings/application/main.swift','-L',resolve('target/debug'),'-lwimm_core_bindings','-Xlinker','-rpath','-Xlinker',resolve('target/debug'),'-o',resolve(root,'swift-probe')]);
 const packages={core:'wimm_core_bindings',privatecontracts:'wimm_finance_types',publiccontracts:'wimm_public_contracts',localcontracts:'wimm_local_contracts',application:'wimm_client_application'};
 await run(process.env.WIMM_KOTLINC??'kotlinc',[...Object.entries(packages).map(([p,file])=>resolve(root,`kotlin/org/wimm/${p}/${file}.kt`)),'tests/contract-bindings/application/Main.kt','-classpath',jar,'-include-runtime','-jvm-target','21','-Werror','-d',resolve(root,'probe.jar')]);
 for(const [runtime,cmd,args]of [['Swift/UniFFI',resolve(root,'swift-probe'),[]],['Kotlin/UniFFI',process.env.WIMM_JAVA??'java',[`-Djna.library.path=${resolve('target/debug')}`,'-cp',`${resolve(root,'probe.jar')}${process.platform==='win32'?';':':'}${jar}`,'MainKt']]]){
  const result=spawnSync(cmd,args,{input,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');const actual=result.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.deepEqual(actual,expected,runtime);runtimes.push(runtime);
 }
}
const result={bindingVersion:2,runtimes,sharedCases:cases.length,actualPreparationCalls:cases.length-formRejected,preparedCases:prepared,formRejected,commandKinds:kinds.size,jsOnlyNegative:3,storageCommit:false};await writeFile(resolve(root,native?'native-results.json':'node-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
