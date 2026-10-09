// SPDX-License-Identifier: AGPL-3.0-or-later
import {StoragePersistenceApplication} from '@wimm/application';
import type {StoragePersistenceOutcome} from '@wimm/contracts';
/** Tatsächliche StorageManager-Anfrage; fehlende API, Ablehnung und API-Fehler bleiben getrennt. */
export async function requestBrowserPersistence():Promise<StoragePersistenceOutcome>{
 try{
  if(typeof navigator==='undefined'||typeof navigator.storage?.persist!=='function')return {supported:false,status:'unsupported'};
  const granted=await navigator.storage.persist();
  return typeof granted==='boolean'?{supported:true,status:granted?'granted':'denied'}:{supported:true,status:'error'};
 }catch{return {supported:true,status:'error'};}
}
export function createBrowserStoragePersistence():StoragePersistenceApplication{return new StoragePersistenceApplication({request:requestBrowserPersistence});}
