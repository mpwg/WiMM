// SPDX-License-Identifier: AGPL-3.0-or-later
import {decodeStorageFailure,StorageFailureError} from '@wimm/storage';
import type {UUID} from '@wimm/contracts';
import type {LocalPortRequestV2,LocalPortOutcomeV2,LocalCommitRequest,BrowserCommitOutcome,LocalOperationIdentity,BrowserReceiptLookup,TransactionIndexQuery,PendingIndexQuery,ImportSourceQuery} from '../generated/sqlite/wimm_browser_runtime.js';
export type SqliteWorkerStatus='waiting'|'opening'|'ready'|'closed'|'failed';
/** Ein Web Lock umfasst die tatsächliche Lebensdauer der SQLite-/OPFS-Verbindung, nicht nur einzelne Requests. */
export class SqliteWorkerClient {
 private worker:Worker|undefined;private next=0;private closed=false;
 private readonly abort=new AbortController();private release=()=>{};
 private readonly pending=new Map<number,{resolve(value:unknown):void;reject(error:unknown):void;timer:ReturnType<typeof setTimeout>}>();
 readonly ready:Promise<void>;
 constructor(profileId:UUID,onStatus:(status:SqliteWorkerStatus)=>void=()=>{}){
  let resolveReady=()=>{};let rejectReady:(error:unknown)=>void=()=>{};
  this.ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  void this.ready.catch(()=>{});
  if(navigator.locks===undefined){onStatus('failed');rejectReady(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));return;}
  onStatus('waiting');
  void navigator.locks.request('wimm:current-sqlite:v5',{signal:this.abort.signal},async()=>{
   if(this.closed)return;
   const held=new Promise<void>(resolve=>{this.release=resolve;});
   onStatus('opening');this.worker=new Worker(new URL('./sqlite-worker.ts',import.meta.url),{type:'module'});
   this.worker.onmessage=({data}:MessageEvent<{id:number;value?:unknown;error?:unknown}>)=>{
    const job=this.pending.get(data.id);if(job===undefined)return;this.pending.delete(data.id);clearTimeout(job.timer);
    if(data.error!==undefined)job.reject(decodeStorageFailure(data.error));else job.resolve(data.value);
   };
   const failed=()=>{onStatus('failed');rejectReady(new StorageFailureError('RESOURCE_UNAVAILABLE','unknown'));this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));};
   this.worker.onerror=failed;this.worker.onmessageerror=failed;
   try{await this.send('open',undefined,profileId);if(this.closed)return;onStatus('ready');resolveReady();await held;}
   catch(error){onStatus('failed');rejectReady(error);this.stop(error);}
  }).catch(error=>{onStatus(this.closed?'closed':'failed');rejectReady(error instanceof StorageFailureError?error:new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));});
  window.addEventListener('pagehide',()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));},{once:true});
 }
 async port(request:LocalPortRequestV2):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('port',request) as LocalPortOutcomeV2;}
 async commit(request:LocalCommitRequest):Promise<BrowserCommitOutcome>{await this.ready;return await this.send('commit',request) as BrowserCommitOutcome;}
 async lookup(identity:LocalOperationIdentity):Promise<BrowserReceiptLookup>{await this.ready;return await this.send('lookup',identity) as BrowserReceiptLookup;}
 async transactions(query:TransactionIndexQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('transactions',query) as LocalPortOutcomeV2;}
 async pendingOperations(query:PendingIndexQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('pending',query) as LocalPortOutcomeV2;}
 async importedTransactions(query:ImportSourceQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('imported',query) as LocalPortOutcomeV2;}
 async close():Promise<void>{
  if(this.closed)return;
  if(this.worker!==undefined){try{await this.send('close',undefined);}finally{this.stop(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));}}
  else this.stop(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
 }
 private send(method:string,input:unknown,profileId?:UUID):Promise<unknown>{
  if(this.closed||this.worker===undefined)return Promise.reject(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
  if(this.pending.size>=64)return Promise.reject(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
  return new Promise((resolve,reject)=>{
   const id=++this.next;
   const timer=setTimeout(()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));},30_000);
   this.pending.set(id,{resolve,reject,timer});
   try{this.worker!.postMessage({id,method,input,profileId});}catch{clearTimeout(timer);this.pending.delete(id);reject(new StorageFailureError('WRITE_FAILED','notCommitted'));}
  });
 }
 private stop(error:unknown):void{
  if(this.closed)return;this.closed=true;this.abort.abort();this.worker?.terminate();this.worker=undefined;
  for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(error);}this.pending.clear();this.release();
 }
}
