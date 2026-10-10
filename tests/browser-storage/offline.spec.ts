// SPDX-License-Identifier: AGPL-3.0-or-later
import {test,expect,chromium,firefox,webkit,type Page} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createAccount,navigate} from '../helpers/ui.js';
import {p5Snapshot,normalized} from '../storage/contracts/snapshot-catalog.js';
const origin='http://127.0.0.1:4180';
const workerPath=`/assets/${readdirSync('apps/web/dist/assets').find(name=>/^sqlite-worker-.*\.js$/.test(name))!}`;
const passphrase='dal04-nur-synthetische-offline-passphrase';
/** Diagnoseconsumer des unveränderten produktiven Buildworkers unter dessen tatsächlichem Web Lock. */
async function ports(page:Page,profileId:string,commands:Record<string,unknown>[]){
 return page.evaluate(async({workerPath,profileId,commands})=>navigator.locks.request('wimm:current-sqlite:v5',async()=>{
  const worker=new Worker(workerPath,{type:'module'});let next=0;
  const pending=new Map<number,{resolve(value:unknown):void;reject(error:unknown):void}>();
  worker.onmessage=({data}:MessageEvent<{id:number;value:unknown;error?:unknown}>)=>{const job=pending.get(data.id);if(job===undefined)return;pending.delete(data.id);if(data.error!==undefined)job.reject(new Error(`Sicherer Workerfehler: ${(data.error as {code:string}).code}`));else job.resolve(data.value);};
  const call=(method:string,input:unknown)=>new Promise<unknown>((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,method,input,profileId});});
  try{await call('open',undefined);const result=[];for(const command of commands)result.push(await call('port',{contractVersion:2,command}));await call('close',undefined);return result;}
  finally{worker.terminate();}
 }),{workerPath,profileId,commands});
}
test('Gebauter PWA-/Rust-DAL startet nach vollständigem Browserneustart offline mit Originaldaten und Entwürfen',async({browserName})=>{
 const engines={chromium,firefox,webkit};const directory=await mkdtemp(resolve('test-results/dal04/offline-profile-'));
 let context=await engines[browserName].launchPersistentContext(directory,{headless:true});
 try{
  let page=await context.newPage();await page.goto(origin);
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button',{name:'Tresor anlegen'}).click();await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();await page.getByRole('button',{name:'Lokalen Bereich eröffnen'}).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByRole('button',{name:'Entsperren'}).click();await expect(page.getByRole('heading',{name:'Alles im Blick.'})).toBeVisible();
  await createAccount(page,'Synthetisches Offline-Prüfkonto','100');
  await page.getByRole('button',{name:'Tresor sperren'}).click();await expect(page.getByRole('heading',{name:'Tresor entsperren'})).toBeVisible();
  const profile=await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('wimm/local-profile/v1')!) as {profileId:string;selectedAreaId:string};return {profileId:value.profileId,spaceId:value.selectedAreaId};});
  // Getrennter synthetischer verbundener Testbereich; keine Outbox im privaten Standalone-Produktbereich.
  const seed=p5Snapshot(2);const fixture=JSON.parse(JSON.stringify({...seed,profileId:profile.profileId,syncState:{...seed.syncState!,profileId:profile.profileId}})) as ReturnType<typeof p5Snapshot>;
  const before=await ports(page,profile.profileId,[{method:'replaceSnapshot',snapshot:fixture},{method:'exportSnapshot',spaceId:fixture.spaceId},{method:'exportSnapshot',spaceId:profile.spaceId}]);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller!==null)).toBe(true);
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();const name=keys.find(name=>name.startsWith('wimm-app-assets-'))!;return (await (await caches.open(name)).keys()).map(request=>new URL(request.url).pathname);});
  expect(cached).toContain(workerPath);expect(cached.some(path=>/wimm_browser_runtime_bg-.*\.wasm$/.test(path))).toBe(true);
  await context.close();context=await engines[browserName].launchPersistentContext(directory,{headless:true});await context.setOffline(true);
  page=await context.newPage();
  const response=await page.goto(origin);expect(response?.status()).toBe(200);await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('heading',{name:'Tresor entsperren'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller!==null)).toBe(true);
  const after=await ports(page,profile.profileId,[{method:'exportSnapshot',spaceId:fixture.spaceId},{method:'exportSnapshot',spaceId:profile.spaceId}]);
  expect(after).toEqual(before.slice(1));expect(normalized((after[0] as {value:ReturnType<typeof p5Snapshot>}).value)).toEqual(normalized(fixture));
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByRole('button',{name:'Entsperren'}).click();await navigate(page,'Konten');await expect(page.getByRole('button',{name:'Synthetisches Offline-Prüfkonto',exact:true})).toBeVisible();
  await createAccount(page,'Auch offline gespeichert');await expect(page.getByRole('button',{name:'Auch offline gespeichert',exact:true})).toBeVisible();
 }finally{await context.close();}
});
