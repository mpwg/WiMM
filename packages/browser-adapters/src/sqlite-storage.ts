// SPDX-License-Identifier: AGPL-3.0-or-later
import type {AtomicBatch,UUID} from '@wimm/contracts';
import {StorageFailureError,type LocalStorageAdapter,type StoredAggregate,type PendingOperation,type StoredProjection,type ConfirmedAggregate,type SyncPage,type SyncState,type LocalSnapshot,type LocalIndexQueryPort,type TransactionIndexQuery,type PendingIndexQuery,type ImportSourceQuery} from '@wimm/storage';
import type {LocalPortCommand,LocalPortOutcomeV2} from '../generated/sqlite/wimm_browser_runtime.js';
import {SqliteWorkerClient,type SqliteWorkerStatus} from './sqlite-worker-client.js';
const connections=new Map<UUID,{client:SqliteWorkerClient;references:number}>();
function invalid():never{throw new StorageFailureError('INVALID_RESPONSE','notCommitted');}
/** Optionale DTO-Felder fehlen auf der Datenleitung; opake Originaldaten werden niemals still korrigiert. */
function wire(value:unknown,strict=false,ancestors=new Set<object>()):unknown{
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))invalid();return value;}
 if(typeof value!=='object'||value===undefined||ancestors.has(value)||ancestors.size>=128)invalid();
 ancestors.add(value);
 try{
  if(Array.isArray(value))return Array.from(value,entry=>wire(entry,strict,ancestors));
  const prototype=Object.getPrototypeOf(value) as unknown;if(prototype!==Object.prototype&&prototype!==null)invalid();
  const result:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const key of Reflect.ownKeys(value)){
   if(typeof key!=='string')invalid();const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
   if(!('value' in descriptor))invalid();const child=descriptor.value as unknown;
   if(child===undefined&&!strict)continue;
   result[key]=wire(child,strict||['draft','mapping','profile'].includes(key),ancestors);
  }
  return result;
 }finally{ancestors.delete(value);}
}
/** Plattformdelegation an den gemeinsamen Rust-DAL, kein eigener Datenbestand oder Commitdienst. */
export class BrowserSqliteStorageAdapter implements LocalStorageAdapter,LocalIndexQueryPort {
 readonly client:SqliteWorkerClient;private closed=false;
 constructor(readonly profileId:UUID,onStatus:(status:SqliteWorkerStatus)=>void=()=>{}){
  let connection=connections.get(profileId);
  if(connection===undefined){connection={client:new SqliteWorkerClient(profileId,onStatus),references:0};connections.set(profileId,connection);}
  connection.references++;this.client=connection.client;
 }
 private ensureOpen():void{if(this.closed)throw new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted');}
 private async call<S extends LocalPortOutcomeV2['status']>(command:unknown,status:S):Promise<Extract<LocalPortOutcomeV2,{status:S}>>{
  this.ensureOpen();
  const result=await this.client.port({contractVersion:2,command:wire(command) as LocalPortCommand});
  if(result.contractVersion!==2||result.status!==status)throw new StorageFailureError('INVALID_RESPONSE','unknown');
  return result as Extract<LocalPortOutcomeV2,{status:S}>;
 }
 async initializeArea(spaceId:UUID,proposedEpoch:UUID):Promise<UUID>{return (await this.call({method:'initializeArea',spaceId,proposedEpoch},'initialized')).epoch as UUID;}
 async readAggregate(handle:UUID):Promise<StoredAggregate|undefined>{return (await this.call({method:'readAggregate',handle},'aggregate')).value as StoredAggregate|null ?? undefined;}
 async query(query:{readonly spaceId:UUID}):Promise<readonly StoredAggregate[]>{return (await this.call({method:'query',query},'aggregates')).value as StoredAggregate[];}
 async applyAtomicBatch(batch:AtomicBatch<StoredAggregate,PendingOperation,StoredProjection>):Promise<void>{await this.call({method:'applyAtomicBatch',batch},'applied');}
 async loadConfirmed(spaceId:UUID):Promise<readonly ConfirmedAggregate[]>{return (await this.call({method:'loadConfirmed',spaceId},'confirmed')).value as ConfirmedAggregate[];}
 async loadPending(spaceId:UUID):Promise<readonly PendingOperation[]>{return (await this.call({method:'loadPending',spaceId},'pending')).value as PendingOperation[];}
 async saveSyncPage(page:SyncPage):Promise<void>{await this.call({method:'saveSyncPage',page},'applied');}
 async getSyncState(spaceId:UUID):Promise<SyncState|undefined>{return (await this.call({method:'getSyncState',spaceId},'syncState')).value as SyncState|null ?? undefined;}
 async exportSnapshot(spaceId:UUID):Promise<LocalSnapshot>{const value=(await this.call({method:'exportSnapshot',spaceId},'snapshot')).value;return {...value,syncState:value.syncState} as LocalSnapshot;}
 async replaceSnapshot(snapshot:LocalSnapshot):Promise<void>{await this.call({method:'replaceSnapshot',snapshot},'applied');}
 async rebuildProjections(spaceId:UUID):Promise<void>{if(this.closed)throw new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted');await this.client.rebuildProjections(spaceId);}
 async queryIndexedTransactions(query:TransactionIndexQuery):Promise<readonly StoredAggregate[]>{this.ensureOpen();const result=await this.client.transactions(wire(query) as TransactionIndexQuery);if(result.status!=='aggregates')invalid();return result.value as StoredAggregate[];}
 async queryIndexedPending(query:PendingIndexQuery):Promise<readonly PendingOperation[]>{this.ensureOpen();const result=await this.client.pendingOperations(wire(query) as PendingIndexQuery);if(result.status!=='pending')invalid();return result.value as PendingOperation[];}
 async queryImportedTransactions(query:ImportSourceQuery):Promise<readonly StoredAggregate[]>{this.ensureOpen();const result=await this.client.importedTransactions(wire(query) as ImportSourceQuery);if(result.status!=='aggregates')invalid();return result.value as StoredAggregate[];}
 async close():Promise<void>{
  if(this.closed)return;this.closed=true;const connection=connections.get(this.profileId);
  if(connection?.client!==this.client)return;
  if(--connection.references===0){connections.delete(this.profileId);await this.client.close();}
 }
}
