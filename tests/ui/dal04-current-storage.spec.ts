// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,test} from '@playwright/test';
import {createAccount,navigate} from '../helpers/ui.js';
const passphrase='dal04-ausschliesslich-synthetische-passphrase';
test('Aktueller Browserclient speichert Konto auf OPFS und öffnet es nach Neustart ohne IndexedDB-Finanzpfad',async({page})=>{
 await page.goto('/');await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByLabel('Passphrase wiederholen').fill(passphrase);
 await page.getByRole('button',{name:'Tresor anlegen'}).click();await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();await page.getByRole('button',{name:'Lokalen Bereich eröffnen'}).click();
 await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByRole('button',{name:'Entsperren'}).click();
 await expect(page.getByRole('heading',{name:'Alles im Blick.'})).toBeVisible();
 await createAccount(page,'Synthetisches OPFS-Konto','100');
 await page.reload();await page.getByLabel('Entsperrpassphrase').fill(passphrase);await page.getByRole('button',{name:'Entsperren'}).click();
 await navigate(page,'Konten');await expect(page.getByRole('button',{name:'Synthetisches OPFS-Konto',exact:true})).toBeVisible();
 const physical=await page.evaluate(async()=>{
  const root=await navigator.storage.getDirectory();const directory=await root.getDirectoryHandle('wimm-current-v5');
  return {directory:directory.name,indexedDbNames:(await indexedDB.databases()).map(database=>database.name)};
 });
 expect(physical.directory).toBe('wimm-current-v5');expect(physical.indexedDbNames.some(name=>name?.startsWith('wimm-ui-'))).toBe(false);
});
