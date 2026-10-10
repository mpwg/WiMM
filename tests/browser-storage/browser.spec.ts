// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,test,chromium,firefox,webkit} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {p5Snapshot,normalized} from '../storage/contracts/snapshot-catalog.js';
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
