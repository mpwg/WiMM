// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,test as base,chromium,firefox,webkit} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import type {LocalCommitRequest} from '../../packages/browser-adapters/generated/sqlite/wimm_browser_runtime.js';
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
