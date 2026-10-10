// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,test,type Page} from '@playwright/test';
import {createVault,createCategory,book,unlock} from '../helpers/local.js';
import {createAccount,navigate} from '../helpers/ui.js';
declare global{interface Window{readonly persistenceCalls:number}}
const origin='http://127.0.0.1:5189';
async function instrument(page:Page){await page.addInitScript(()=>{const native=navigator.storage.persist.bind(navigator.storage);let calls=0;Object.defineProperty(window,'persistenceCalls',{get:()=>calls});navigator.storage.persist=async()=>{calls++;return native();};});}
const storageModule='/@fs'+process.cwd()+'/packages/browser-adapters/src/sqlite-storage.ts';
async function records(page:Page){return page.evaluate(async url=>{
 const profile=JSON.parse(localStorage.getItem('wimm/local-profile/v1')!) as {profileId:string;selectedAreaId:string};
 const {BrowserSqliteStorageAdapter}=await import(/* @vite-ignore */ url) as typeof import('../../packages/browser-adapters/src/sqlite-storage.js');
 const storage=new BrowserSqliteStorageAdapter(profile.profileId);
 try{return await storage.query({spaceId:profile.selectedAreaId});}finally{await storage.close();}
},storageModule);}
test('Webeinstieg fragt die echte StorageManager-Persistenz an und zeigt deren tatsächliche Ablehnung',async({page})=>{
 await instrument(page);await createVault(page);await expect(page.locator('[data-persistence-status=denied]')).toBeVisible();expect(await page.evaluate(()=>navigator.storage.persisted())).toBe(false);expect(await page.evaluate(()=>window.persistenceCalls)).toBe(1);
 await createAccount(page,'Synthetisches Persistenzkonto','10');const before=await records(page);await page.getByRole('button',{name:'Dauerhafte Speicherung erneut anfragen'}).click();await expect(page.locator('[data-persistence-status=denied]')).toBeVisible();expect(await records(page)).toEqual(before);
});
test('Tatsächliche Chromium-Berechtigung bestätigt Persistenz im Webeinstieg',async({page,context})=>{
 const session=await context.newCDPSession(page);const info=await session.send('Target.getTargetInfo');await session.send('Browser.grantPermissions',{permissions:['durableStorage'],origin,...(info.targetInfo.browserContextId===undefined?{}:{browserContextId:info.targetInfo.browserContextId})});await instrument(page);await createVault(page);await navigate(page,'Einstellungen');await expect(page.locator('[data-persistence-status=granted]')).toBeVisible();expect(await page.evaluate(()=>navigator.storage.persisted())).toBe(true);expect(await page.evaluate(()=>window.persistenceCalls)).toBe(1);
});
test('Fehlende Persistenz-API wird in echter Weboberfläche getrennt angezeigt (kontrollierte API-Simulation)',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator.storage,'persist',{value:undefined}));await createVault(page);await expect(page.locator('[data-persistence-status=unsupported]')).toBeVisible();await createAccount(page,'Synthetischer Bestand ohne Persistenz','5');expect((await records(page) as unknown[]).length).toBeGreaterThan(0);
});
test('Persistenz-API-Fehler erzeugt keinen vermeintlichen Erfolg (kontrollierte API-Simulation)',async({page})=>{
 await page.addInitScript(()=>{navigator.storage.persist=async()=>{throw new DOMException('Synthetischer API-Fehler','SecurityError');};});await createVault(page);await expect(page.locator('[data-persistence-status=error]')).toBeVisible();await createAccount(page,'Synthetischer Bestand nach API-Fehler','5');expect((await records(page) as unknown[]).length).toBeGreaterThan(0);
});

test('Tatsächlicher OPFS-Quotafehler in der PWA erhält den vollständigen Buchungsentwurf und dauerhaften Originalbestand',async({page,context})=>{
 await createVault(page);await createAccount(page,'Synthetisches Quotakonto');await createCategory(page,'Synthetische Quotakategorie');
 const before=await records(page);const note='Ausschließlich synthetischer Originalentwurf. '.repeat(8192);
 const dialog=await book(page,'-12,34',note,'Synthetisches Quotakonto','Synthetische Quotakategorie');
 const selectedAccount=await dialog.getByRole('combobox',{name:'Konto',exact:true}).inputValue();const selectedCategory=await dialog.getByRole('combobox',{name:'Kategorie',exact:true}).inputValue();
 const usage=await page.evaluate(async()=>(await navigator.storage.estimate()).usage);expect(typeof usage).toBe('number');
 const session=await context.newCDPSession(page);await session.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:usage!+4096});
 try{
  await dialog.getByRole('button',{name:'Lokal speichern',exact:true}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Betrag',{exact:true})).toHaveValue('12,34');await expect(dialog.getByLabel('Datum',{exact:true})).toHaveValue('2026-10-04');await expect(dialog.getByLabel('Notiz',{exact:true})).toHaveValue(note);
  await expect(dialog.getByRole('combobox',{name:'Konto',exact:true})).toHaveValue(selectedAccount);await expect(dialog.getByRole('combobox',{name:'Kategorie',exact:true})).toHaveValue(selectedCategory);
  await expect(page.getByText('Lokal gespeichert.',{exact:true})).toHaveCount(0);
 }finally{await session.send('Storage.overrideQuotaForOrigin',{origin});await session.detach();}
 await page.reload();await unlock(page);expect(await records(page)).toEqual(before);
 // Erst nach tatsächlicher Originalprüfung bewusst dieselbe gültige Eingabe erneut bestätigen; kein automatischer Retry.
 const again=await book(page,'-12,34',note,'Synthetisches Quotakonto','Synthetische Quotakategorie');await again.getByRole('button',{name:'Lokal speichern',exact:true}).click();await expect(again).toHaveCount(0);
 expect((await records(page)).filter(entry=>entry.aggregateType==='transaction'&&'note' in entry&&entry.note===note.trim())).toHaveLength(1);
});
