// SPDX-License-Identifier: AGPL-3.0-or-later
import {base64UrlSchema,uuidSchema,type EncryptedBackupPort,type EncryptedBackupReceipt,type IdSourcePort} from '@wimm/contracts';
type Input=Parameters<EncryptedBackupPort['persist']>[0];
interface Record extends EncryptedBackupReceipt { readonly ciphertext:Uint8Array }
function open(name:string):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{let failed=false;const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('backups',{keyPath:'backupId'});request.onerror=()=>reject(new Error('Die verschlüsselte Sicherung kann nicht geöffnet werden.'));request.onblocked=()=>{failed=true;reject(new Error('Die Sicherung ist durch einen anderen geöffneten Client blockiert.'));};request.onsuccess=()=>{if(failed){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};});}
function same(a:Uint8Array,b:Uint8Array){return a.length===b.length&&a.every((value,index)=>value===b[index]);}
/** Eigenständiger Chiffratspeicher; vollständig bestätigter strikter Commit und anschließendes Rücklesen. */
export class BrowserEncryptedBackupPort implements EncryptedBackupPort {
 constructor(private readonly ids:IdSourcePort,private readonly databaseName='wimm:encrypted-backups'){}
 async read(receipt:EncryptedBackupReceipt):Promise<Uint8Array>{
  if(![receipt.backupId,receipt.profileId,receipt.spaceId,receipt.epoch].every(id=>uuidSchema.safeParse(id).success)||!base64UrlSchema.safeParse(receipt.snapshotHash).success)throw new Error('Die Sicherungshülle ist nicht gültig.');
  const db=await open(this.databaseName);
  try{
   const stored=await new Promise<Record>((resolve,reject)=>{const tx=db.transaction('backups','readonly');const request=tx.objectStore('backups').get(receipt.backupId);let value:Record|undefined;request.onsuccess=()=>{value=request.result as Record|undefined;};tx.oncomplete=()=>{if(value===undefined)reject(new Error('Die Sicherung fehlt beim Rücklesen.'));else resolve(value);};tx.onabort=()=>reject(new Error('Die Sicherung kann nicht überprüft werden.'));tx.onerror=()=>reject(new Error('Die Sicherung kann nicht überprüft werden.'));});
   if(stored.backupId!==receipt.backupId||stored.profileId!==receipt.profileId||stored.spaceId!==receipt.spaceId||stored.epoch!==receipt.epoch||stored.snapshotHash!==receipt.snapshotHash||!(stored.ciphertext instanceof Uint8Array)||stored.ciphertext.length===0)throw new Error('Die gespeicherte Sicherung passt nicht zum angeforderten Beleg.');
   return stored.ciphertext.slice();
  }finally{db.close();}
 }
 async persist(input:Input):Promise<EncryptedBackupReceipt>{
  const backupId=this.ids.next();
  if(![backupId,input.profileId,input.spaceId,input.epoch].every(id=>uuidSchema.safeParse(id).success)||!base64UrlSchema.safeParse(input.snapshotHash).success||!(input.ciphertext instanceof Uint8Array)||input.ciphertext.byteLength===0)throw new Error('Die Sicherungshülle ist nicht gültig.');
  const receipt:EncryptedBackupReceipt={backupId,profileId:input.profileId,spaceId:input.spaceId,epoch:input.epoch,snapshotHash:input.snapshotHash};
  const ciphertext=input.ciphertext.slice();const db=await open(this.databaseName);
  try{
   await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('backups','readwrite',{durability:'strict'});if(transaction.durability!=='strict'){transaction.abort();reject(new Error('Eine dauerhafte Sicherung kann in diesem Browser nicht bestätigt werden.'));return;}transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('Die verschlüsselte Sicherung wurde nicht dauerhaft gespeichert.'));transaction.onabort=()=>reject(new Error('Die verschlüsselte Sicherung wurde nicht dauerhaft gespeichert.'));transaction.objectStore('backups').add({...receipt,ciphertext});});
   const stored=await new Promise<Record>((resolve,reject)=>{const tx=db.transaction('backups','readonly');const request=tx.objectStore('backups').get(backupId);let value:Record|undefined;request.onsuccess=()=>{value=request.result as Record|undefined;};tx.oncomplete=()=>{if(value===undefined)reject(new Error('Die Sicherung fehlt beim Rücklesen.'));else resolve(value);};tx.onabort=()=>reject(new Error('Die Sicherung kann nicht überprüft werden.'));tx.onerror=()=>reject(new Error('Die Sicherung kann nicht überprüft werden.'));});
   if(stored.profileId!==receipt.profileId||stored.spaceId!==receipt.spaceId||stored.epoch!==receipt.epoch||stored.snapshotHash!==receipt.snapshotHash||!(stored.ciphertext instanceof Uint8Array)||!same(stored.ciphertext,ciphertext))throw new Error('Die gespeicherte Sicherung stimmt nicht mit der Originalhülle überein.');
   return receipt;
  }finally{db.close();}
 }
}
