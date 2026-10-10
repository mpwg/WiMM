// SPDX-License-Identifier: AGPL-3.0-or-later
// Nur Consumer des regulären Rust-/OPFS-Adapters; ein tatsächlicher Besitzerwechsel je Profilwechsel.
import {BrowserSqliteStorageAdapter} from '../../../packages/browser-adapters/src/sqlite-storage.js';
import type {UUID} from '@wimm/contracts';
import type {LocalStorageAdapter} from '@wimm/storage';
import {runSnapshotCase,negativeSnapshotVariants,p5Snapshot,normalized,equal,type SnapshotCase,profileId,spaceId} from '../../../tests/storage/contracts/snapshot-catalog.js';
export async function runBrowserSnapshotCase(scenario:SnapshotCase,initial:BrowserSqliteStorageAdapter):Promise<void>{
 let current:BrowserSqliteStorageAdapter|undefined=initial;
 const getOwner=async(profile:UUID)=>{
  if(current!==undefined&&current.profileId!==profile){await current.close();current=undefined;}
  current??=new BrowserSqliteStorageAdapter(profile);await current.client.ready;return current;
 };
 const access=(profile:UUID):LocalStorageAdapter=>({
  profileId:profile,
  async initializeArea(space,epoch){return (await getOwner(profile)).initializeArea(space,epoch);},
  async readAggregate(id){return (await getOwner(profile)).readAggregate(id);},
  async query(query){return (await getOwner(profile)).query(query);},
  async applyAtomicBatch(batch){return (await getOwner(profile)).applyAtomicBatch(batch);},
  async loadConfirmed(space){return (await getOwner(profile)).loadConfirmed(space);},
  async loadPending(space){return (await getOwner(profile)).loadPending(space);},
  async saveSyncPage(page){return (await getOwner(profile)).saveSyncPage(page);},
  async getSyncState(space){return (await getOwner(profile)).getSyncState(space);},
  async exportSnapshot(space){return (await getOwner(profile)).exportSnapshot(space);},
  async replaceSnapshot(snapshot){return (await getOwner(profile)).replaceSnapshot(snapshot);},
  async rebuildProjections(space){return (await getOwner(profile)).rebuildProjections(space);}
 });
 const storage=access(profileId);
 try{await runSnapshotCase(scenario,{storage,storageSchemaVersion:2,
  async restart(){await current?.close();current=undefined;await getOwner(profileId);return storage;},
  forProfile:access,async close(){await current?.close();current=undefined;}
 });}finally{await current?.close();}
}

/** Dieselben 26 Negativformen unmittelbar am Rust-Port, ohne TS-Snapshotvalidator. */
export async function runDirectNegativeSnapshots(adapter:BrowserSqliteStorageAdapter):Promise<number>{
 const source=JSON.parse(JSON.stringify(p5Snapshot(2))) as ReturnType<typeof p5Snapshot>;
 await adapter.client.port({contractVersion:2,command:{method:'replaceSnapshot',snapshot:source as unknown as import('../../../packages/browser-adapters/generated/sqlite/wimm_browser_runtime.js').LocalSnapshot}});
 const read=async()=>{
  const result=await adapter.client.port({contractVersion:2,command:{method:'exportSnapshot',spaceId}});
  if(result.status!=='snapshot')throw new Error('Rust-Snapshotantwort fehlt.');
  return normalized(result.value as unknown as ReturnType<typeof p5Snapshot>);
 };
 const before=await read();const cases=negativeSnapshotVariants(before);
 for(const [index,snapshot] of cases.entries()){
  let rejected=false;
  try{await adapter.client.port({contractVersion:2,command:{method:'replaceSnapshot',snapshot:snapshot as import('../../../packages/browser-adapters/generated/sqlite/wimm_browser_runtime.js').LocalSnapshot}});}catch(error){
   const failure=error as {code:string;commitState:string};
   if(typeof failure.code!=='string'||!['notCommitted','unknown'].includes(failure.commitState))throw new Error('Rust-Ablehnung ohne sichere Fehlerhülle.');
   rejected=true;
  }
  if(!rejected||!equal(before,await read()))throw new Error(`Rust-Negativfall ${index} verändert den Originalbestand oder meldet Erfolg.`);
 }
 return cases.length;
}

/** Bestehende F01-/Transfer-/Erstattungs-/Tombstonewerte; ausschließlich aktuelle Cacheadressen. */
export async function runCurrentRebuildOracle(adapter:BrowserSqliteStorageAdapter):Promise<void>{
 const {financeSnapshot}=await import('../../../tests/storage/contracts/rebuild-catalog.js');
 const original=financeSnapshot(2);try{await adapter.replaceSnapshot(original);}catch(error){throw new Error(`Initialer F01-Snapshot: ${(error as {code:string}).code}`);}
 await adapter.applyAtomicBatch({expectedRevisions:[],aggregates:[],outbox:[],projections:[{spaceId,kind:'accountBalance',key:'10000000-0000-4000-8000-000000000010',payload:{balance:999}}]});
 try{await adapter.rebuildProjections(spaceId);}catch(error){throw new Error(`Rust-F01-Neuaufbau: ${(error as {code:string}).code}`);}const actual=await adapter.exportSnapshot(spaceId);
 const expected=original.projections.filter(entry=>entry.kind!=='balance');
 const order=(values:readonly import('@wimm/storage').StoredProjection[])=>[...values].sort((a,b)=>`${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`));
 if(!equal(order(actual.projections),order(expected)))throw new Error('Aktuelle Rust-Caches weichen von gesperrten F01-/Transfer-/Erstattungs-/Monatswerten ab.');
 const before=normalized(actual);await adapter.rebuildProjections(spaceId);
 if(!equal(before,normalized(await adapter.exportSnapshot(spaceId))))throw new Error('Rust-Neuaufbau ist nicht idempotent.');
 await adapter.close();const reopened=new BrowserSqliteStorageAdapter(profileId);
 try{if(!equal(before,normalized(await reopened.exportSnapshot(spaceId))))throw new Error('Rust-Neuaufbau geht nach tatsächlicher Wiederöffnung verloren.');}finally{await reopened.close();}
}
