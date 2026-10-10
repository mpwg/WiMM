// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,test as base,chromium,firefox,webkit} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import type {LocalCommitRequest,RuntimeRequestV2} from '../../packages/browser-adapters/generated/sqlite/wimm_browser_runtime.js';
import {randomUUID} from 'node:crypto';
import {p5Snapshot,normalized} from '../storage/contracts/snapshot-catalog.js';
const engines={chromium,firefox,webkit};
const test=base.extend({context:async({browserName},provide)=>{
 const dir=await mkdtemp(resolve('test-results/dal04/contract-browser-profile-'));
 const context=await engines[browserName].launchPersistentContext(dir,{headless:true});
 try{await provide(context);}finally{await context.close();}
}});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const port=(page:import('@playwright/test').Page,command:Record<string,unknown>)=>page.evaluate(async command=>{
 const client=(window as unknown as {sqliteClient:{port(request:unknown):Promise<unknown>}}).sqliteClient;
 return await client.port({contractVersion:2,command});
},command);
async function ready(page:import('@playwright/test').Page,profile:string){await page.goto(`/tests/browser-storage.html?profile=${profile}`);await expect.poll(()=>page.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');}
test('Aktueller ORM-/OPFS-Worker hält Epoche über Worker- und Seitenneustart',async({page})=>{
 await ready(page,randomUUID());
 const result=await port(page,{method:'initializeArea',spaceId:id(2),proposedEpoch:id(3)});expect(result).toEqual({status:'initialized',contractVersion:2,epoch:id(3)});
 const before=await port(page,{method:'exportSnapshot',spaceId:id(2)});expect(before).toMatchObject({status:'snapshot',contractVersion:2,value:{storageSchemaVersion:2,domainSchemaVersion:1,epoch:id(3),aggregates:[],confirmed:[],pending:[],projections:[]}});
 await page.reload();await expect.poll(()=>page.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');
 expect(await port(page,{method:'exportSnapshot',spaceId:id(2)})).toEqual(before);
 expect(await port(page,{method:'initializeArea',spaceId:id(2),proposedEpoch:id(99)})).toEqual(result);
});
test('Zweiter Tab wartet auf tatsächliche OPFS-Freigabe und öffnet denselben Stand',async({page,context})=>{
 const profile=randomUUID();await ready(page,profile);await port(page,{method:'initializeArea',spaceId:id(2),proposedEpoch:id(3)});
 const other=await context.newPage();await other.goto(`/tests/browser-storage.html?profile=${profile}`);
 await expect.poll(()=>other.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('waiting');
 await page.evaluate(async()=>{await(window as unknown as {sqliteClient:{close():Promise<void>}}).sqliteClient.close();});
 await expect.poll(()=>other.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');
 expect(await port(other,{method:'exportSnapshot',spaceId:id(2)})).toMatchObject({value:{epoch:id(3),storageSchemaVersion:2}});
});

test('Aktueller Rust-Fachvalidator und ORM erhalten P5-Daten, Entwürfe und Cursor über Seitenneustart',async({page})=>{
 const profile=randomUUID();await ready(page,profile);
 const seed=p5Snapshot(2);
 const source=JSON.parse(JSON.stringify({...seed,profileId:profile,syncState:{...seed.syncState!,profileId:profile}})) as ReturnType<typeof p5Snapshot>;
 const outcome=await page.evaluate(async source=>{
 try{return {value:await(window as unknown as {sqliteClient:{port(input:unknown):Promise<unknown>}}).sqliteClient.port({contractVersion:2,command:{method:'replaceSnapshot',snapshot:source}})};}
 catch(error){const failure=error as {code?:string;commitState?:string};return {code:failure.code,commitState:failure.commitState};}
},source);
 expect(outcome).toEqual({value:{status:'applied',contractVersion:2}});
 const before=await port(page,{method:'exportSnapshot',spaceId:source.spaceId}) as {value:typeof source};
 expect(normalized(before.value)).toEqual(normalized(source));
 await page.reload();await expect.poll(()=>page.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');
 expect(normalized((await port(page,{method:'exportSnapshot',spaceId:source.spaceId}) as {value:typeof source}).value)).toEqual(normalized(source));
});

test('Vollständiger Browserprozess-Neustart erhält aktuellen OPFS-Snapshot ohne Ersatzspeicher',async({browserName})=>{
 const dir=await mkdtemp(resolve('test-results/dal04/browser-profile-'));const engine={chromium,firefox,webkit}[browserName];
 const profile=randomUUID();const seed=p5Snapshot(2);const source=JSON.parse(JSON.stringify({...seed,profileId:profile,syncState:{...seed.syncState!,profileId:profile}})) as ReturnType<typeof p5Snapshot>;
 let context=await engine.launchPersistentContext(dir,{headless:true});
 try{
  let page=await context.newPage();await page.goto(`http://127.0.0.1:4179/tests/browser-storage.html?profile=${profile}`);await expect.poll(()=>page.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');
  await port(page,{method:'replaceSnapshot',snapshot:source});const before=await port(page,{method:'exportSnapshot',spaceId:source.spaceId});
  await context.close();context=await engine.launchPersistentContext(dir,{headless:true});
  page=await context.newPage();await page.goto(`http://127.0.0.1:4179/tests/browser-storage.html?profile=${profile}`);await expect.poll(()=>page.evaluate(()=>(window as unknown as {sqliteStatus:string}).sqliteStatus)).toBe('ready');
  expect(await port(page,{method:'exportSnapshot',spaceId:source.spaceId})).toEqual(before);
 }finally{await context.close();}
});

test('Aktuelle Rust-Receipts und stale CAS über Tabübergabe bleiben idempotent und dauerhaft',async({page,context})=>{
 const profile=randomUUID();await ready(page,profile);
 const original=JSON.parse(readFileSync('crates/local-dal/tests/fixtures/receipt-request.json','utf8')) as LocalCommitRequest;original.identity.profileId=profile;
 await port(page,{method:'initializeArea',spaceId:original.identity.spaceId,proposedEpoch:original.identity.epoch});
 const commit=(page:import('@playwright/test').Page,input:LocalCommitRequest)=>page.evaluate(async input=>await window.sqliteClient.commit(input),input);
 const first=await commit(page,original);expect(first.status).toBe('committed');
 expect(await commit(page,original)).toEqual(first);
 const other=await context.newPage();await other.goto(`/tests/browser-storage.html?profile=${profile}`);await expect.poll(()=>other.evaluate(()=>window.sqliteStatus)).toBe('waiting');
 await page.evaluate(async()=>await window.sqliteClient.close());await expect.poll(()=>other.evaluate(()=>window.sqliteStatus)).toBe('ready');
 expect(await commit(other,original)).toEqual(first);
 const stale=structuredClone(original);stale.identity.operationId=id(80);stale.batch.outbox[0]!.operationId=id(81);
 expect(await commit(other,stale)).toMatchObject({status:'notCommitted',error:{code:'REVISION_CONFLICT',commitState:'notCommitted'}});
 const changed=structuredClone(original);changed.batch.outbox=[];
 expect(await commit(other,changed)).toMatchObject({status:'notCommitted',error:{code:'OPERATION_ID_REUSED',commitState:'notCommitted'}});
 const before=await port(other,{method:'exportSnapshot',spaceId:original.identity.spaceId});expect(before).toMatchObject({value:{aggregates:original.batch.aggregates,pending:original.batch.outbox}});
 await other.reload();await expect.poll(()=>other.evaluate(()=>window.sqliteStatus)).toBe('ready');
 expect(await commit(other,original)).toEqual(first);expect(await port(other,{method:'exportSnapshot',spaceId:original.identity.spaceId})).toEqual(before);
});

test('WebKit-Privatmodus weist fehlende OPFS-Persistenz sichtbar vor einem Write ab',async({browserName})=>{
 test.skip(browserName!=='webkit','Tatsächliche WebKit-Privatmodusgrenze, keine Chrome-/Firefoxbehauptung.');
 const browser=await webkit.launch({headless:true});const context=await browser.newContext();
 try{
  const page=await context.newPage();await page.goto(`http://127.0.0.1:4179/tests/browser-storage.html?profile=${randomUUID()}`);
  const result=await page.evaluate(async()=>{try{await window.sqliteClient.ready;return {unexpectedReady:true};}catch(error){const failure=error as {code:string;commitState:string};return {code:failure.code,commitState:failure.commitState};}});
  expect(result).toEqual({code:'RESOURCE_UNAVAILABLE',commitState:'notCommitted'});
  expect(await page.evaluate(()=>window.sqliteStatus)).toBe('failed');
 }finally{await context.close();await browser.close();}
});

test('Verschlüsseltes Backup bleibt nach OPFS-Wiederöffnung erhalten und weist fremden Scope ab',async({page})=>{
 const profile=randomUUID();await ready(page,profile);
 const receipt={backupId:id(90),profileId:profile,spaceId:id(2),epoch:id(3),snapshotHash:'c3ludGhldGlzY2g'};
 const plaintext={syntheticPrivateNote:'Nur synthetischer Backup-Prüfwert',amount:12345};
 const ciphertext=await page.evaluate(async value=>Array.from(await window.backupProtector.seal(value)),plaintext);
 expect(new TextDecoder().decode(new Uint8Array(ciphertext))).not.toContain(plaintext.syntheticPrivateNote);
 expect(await page.evaluate(async input=>await window.sqliteClient.persistBackup(input),{receipt,ciphertext})).toEqual(receipt);
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.sqliteStatus)).toBe('ready');
 const stored=await page.evaluate(async receipt=>await window.sqliteClient.readBackup(receipt),receipt);
 expect(stored).toEqual({contractVersion:2,ciphertext});
 expect(await page.evaluate(async bytes=>await window.backupProtector.unseal(new Uint8Array(bytes)),stored.ciphertext)).toEqual(plaintext);
 const rejection=await page.evaluate(async receipt=>{try{await window.sqliteClient.readBackup(receipt);return null;}catch(error){const failure=error as {code:string;commitState:string};return {code:failure.code,commitState:failure.commitState};}},{...receipt,profileId:id(91)});
 expect(rejection).toEqual({code:'EPOCH_MISMATCH',commitState:'notCommitted'});
 const duplicate=await page.evaluate(async input=>{try{await window.sqliteClient.persistBackup(input);return null;}catch(error){return (error as {code:string}).code;}},{receipt,ciphertext:[99]});
 expect(duplicate).toBe('WRITE_FAILED');
 expect(await page.evaluate(async receipt=>await window.sqliteClient.readBackup(receipt),receipt)).toEqual(stored);
});

test('Gemeinsame Rust-Anwendung schreibt echte SQLite-Receipts und führt Undo/Redo im Worker aus',async({page})=>{
 const profile=randomUUID();await ready(page,profile);
 type CommandInput=Extract<RuntimeRequestV2['action'],{actionType:'execute'}> & {spaceId:string;aggregates:Array<{id:string}>};
 const catalog=JSON.parse(readFileSync('crates/finance-core/tests/fixtures/contract-catalog.json','utf8')) as Array<{name:string;request:CommandInput}>;
 const request=catalog.find(row=>row.name==='Buchungs-CAS F01 neue Ausgabe')!.request;
 const context={profileId:profile,spaceId:request.spaceId,epoch:id(3),profileRevision:1,sessionGeneration:1,generation:1};
 await port(page,{method:'initializeArea',spaceId:request.spaceId,proposedEpoch:context.epoch});
 await port(page,{method:'replaceSnapshot',snapshot:{storageSchemaVersion:2,domainSchemaVersion:1,profileId:profile,spaceId:request.spaceId,epoch:context.epoch,aggregates:request.aggregates.map(aggregate=>({...aggregate,handle:aggregate.id})),confirmed:[],pending:[],projections:[]}});
 await page.evaluate(async context=>await window.sqliteClient.openRuntime({contractVersion:2,context,mode:'connected',key:Array(32).fill(42) as number[]}),context);
 const input:RuntimeRequestV2={contractVersion:2,domainSchemaVersion:1,action:{actionType:'execute',command:request.command,expectedRevisions:request.expectedRevisions,operation:request.operation??(request as unknown as {context:CommandInput['operation']}).context}};
 const rejected=await page.evaluate(async input=>await window.sqliteClient.runtime(input),{...input,contractVersion:1});
 expect(rejected.result).toMatchObject({status:'rejected',code:'UPDATE_REQUIRED'});
 const event=await page.evaluate(async input=>await window.sqliteClient.runtime(input),input);
 expect(event.result.status).toBe('committed');expect(event.canUndo).toBe(true);
 if(event.result.status!=='committed')throw new Error('Echtes Receipt fehlt.');
 expect(await page.evaluate(async identity=>await window.sqliteClient.lookup(identity),event.result.receipt.identity)).toMatchObject({receipt:event.result.receipt});
 const operation=(n:number)=>({operationId:id(n),occurredAt:'2026-10-10T12:00:00Z',generatedIds:[]});
 for(const [direction,n] of [['undo',94],['redo',95]] as const){
  const result=await page.evaluate(async input=>await window.sqliteClient.runtime(input),{contractVersion:2,domainSchemaVersion:1,action:{actionType:'history',direction,operation:operation(n)}} as RuntimeRequestV2);
  expect(result.result.status).toBe('committed');
 }
 const before=await page.evaluate(async()=>await window.sqliteClient.runtimePage(0,100));expect(before.aggregates.length).toBeGreaterThan(0);
 for(const limit of [101,1.5,Number.NaN])expect(await page.evaluate(async limit=>{try{await window.sqliteClient.runtimePage(0,limit);return null;}catch(error){return (error as {code:string}).code;}},limit)).toBe('INVALID_RESPONSE');
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.sqliteStatus)).toBe('ready');
 await page.evaluate(async context=>await window.sqliteClient.openRuntime({contractVersion:2,context,mode:'connected',key:Array(32).fill(42) as number[]}),context);
 expect((await page.evaluate(async()=>await window.sqliteClient.runtime({contractVersion:2,domainSchemaVersion:1,action:{actionType:'load'}}))).result.status).toBe('state');
 expect(await page.evaluate(async()=>await window.sqliteClient.runtimePage(0,100))).toEqual(before);
});

test('Produktiver PWA-Adapter teilt Profilverbindung mit Export und erhält Rust-Projektionen',async({page})=>{
 const profile=randomUUID();await ready(page,profile);
 const seed=p5Snapshot(2);const snapshot={...seed,profileId:profile,syncState:{...seed.syncState!,profileId:profile}};
 const result=await page.evaluate(async snapshot=>{
  const first=window.sqliteAdapter;const exported=window.sqliteCreateAdapter();
  const shared=first.client===exported.client;
  await first.replaceSnapshot(snapshot);const before=await exported.exportSnapshot(snapshot.spaceId);
  await exported.close();await first.rebuildProjections(snapshot.spaceId);
  const after=await first.exportSnapshot(snapshot.spaceId);
  await first.close();const reopened=window.sqliteCreateAdapter();
  const persistent=await reopened.exportSnapshot(snapshot.spaceId);await reopened.close();
  return {shared,before,after,persistent};
 },snapshot);
 expect(result.shared).toBe(true);expect(normalized(result.before)).toEqual(normalized(snapshot));
 expect(result.after.aggregates).toEqual(result.before.aggregates);expect(result.after.pending).toEqual(result.before.pending);expect(result.after.syncState).toEqual(result.before.syncState);
 expect(result.after.projections.some(entry=>entry.kind==='accountBalance')).toBe(true);expect(result.after.projections.some(entry=>entry.kind==='consumption'&&entry.key==='all')).toBe(true);
 expect(result.persistent).toEqual(result.after);
});
