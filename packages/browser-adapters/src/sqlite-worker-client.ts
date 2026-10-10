// SPDX-License-Identifier: AGPL-3.0-or-later
import sodium from 'libsodium-wrappers-sumo';
import {decodeStorageFailure,StorageFailureError} from '@wimm/storage';
import type {UUID} from '@wimm/contracts';
import type {LocalPortRequestV2,LocalPortOutcomeV2,LocalCommitRequest,BrowserCommitOutcome,LocalOperationIdentity,BrowserReceiptLookup,TransactionIndexQuery,PendingIndexQuery,ImportSourceQuery,BrowserBackupInput,EncryptedBackupReceipt,BrowserCiphertext,BrowserRuntimeOpen,RuntimeRequestV2,RuntimeEventV2,RuntimePageV2} from '../generated/sqlite/wimm_browser_runtime.js';
export type SqliteWorkerStatus='waiting'|'opening'|'ready'|'closed'|'failed';
/** Ein Web Lock umfasst die tatsächliche Lebensdauer der SQLite-/OPFS-Verbindung, nicht nur einzelne Requests. */
export class SqliteWorkerClient {
 private worker:Worker|undefined;private next=0;private closed=false;private owner:string|undefined;private owning=false;
 private readonly clientId=crypto.randomUUID();private readonly channel:BroadcastChannel|undefined;
 private keyMaterial:{publicKey:Uint8Array;privateKey:Uint8Array}|undefined;
 private readonly keys=sodium.ready.then(()=>{const keys=sodium.crypto_box_keypair();this.keyMaterial=keys;return keys;});
 private readonly peers=new Map<string,Uint8Array>();
 private readonly abort=new AbortController();private release=()=>{};
 private readonly pending=new Map<number,{resolve(value:unknown):void;reject(error:unknown):void;timer:ReturnType<typeof setTimeout>;peer:boolean}>();
 private resolveReady=()=>{};private rejectReady:(error:unknown)=>void=()=>{};
 readonly ready:Promise<void>;
 constructor(private readonly profileId:UUID,private readonly onStatus:(status:SqliteWorkerStatus)=>void=()=>{}){
  this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});void this.ready.catch(()=>{});
  if(navigator.locks===undefined||typeof BroadcastChannel==='undefined'){onStatus('failed');this.rejectReady(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));return;}
  this.channel=new BroadcastChannel(`wimm:current-sqlite:v5:${profileId}`);
  this.channel.onmessage=({data}:MessageEvent<PeerMessage>)=>{void this.receive(data).catch(()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));});};
  onStatus('waiting');
  void navigator.locks.request('wimm:current-sqlite:v5',{signal:this.abort.signal},async()=>{
   if(this.closed)return;
   this.rejectPeerJobs();this.owner=undefined;this.owning=true;
   const held=new Promise<void>(resolve=>{this.release=resolve;});
   onStatus('opening');this.worker=new Worker(new URL('./sqlite-worker.ts',import.meta.url),{type:'module'});
   this.worker.onmessage=({data}:MessageEvent<{id:number;value?:unknown;error?:unknown}>)=>{this.finish(data.id,data.value,data.error);};
   const failed=()=>{onStatus('failed');this.rejectReady(new StorageFailureError('RESOURCE_UNAVAILABLE','unknown'));this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));};
   this.worker.onerror=failed;this.worker.onmessageerror=failed;
   try{await this.sendLocal('open',undefined,this.clientId);if(this.closed)return;this.owner=this.clientId;onStatus('ready');this.resolveReady();this.post({type:'owner',target:'*'});await held;}
   catch(error){onStatus('failed');this.rejectReady(error);this.stop(error);}
  }).catch(error=>{onStatus(this.closed?'closed':'failed');this.rejectReady(error instanceof StorageFailureError?error:new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));});
  this.post({type:'hello',target:'*'});
  window.addEventListener('pagehide',()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));},{once:true});
 }
 private post(message:Omit<PeerMessage,'version'|'profileId'|'sender'>):void{
  if(message.type!=='request'&&message.type!=='result'&&this.keyMaterial!==undefined&&!this.closed){this.channel?.postMessage({...message,version:2,profileId:this.profileId,sender:this.clientId,publicKey:Array.from(this.keyMaterial.publicKey)});return;}
  void this.keys.then(keys=>{
   if(this.closed)return;
   const header={version:2 as const,profileId:this.profileId,sender:this.clientId,target:message.target,type:message.type,publicKey:Array.from(keys.publicKey),...(message.id===undefined?{}:{id:message.id})};
   if(message.type==='request'||message.type==='result'){
    const recipient=this.peers.get(message.target);if(recipient===undefined)throw new Error('Peer fehlt.');
    const payload=JSON.stringify({...header,method:message.method,input:message.input,value:message.value,error:message.error},(_key,value:unknown)=>{if(typeof value==='number'&&!Number.isFinite(value)||typeof value==='bigint'||typeof value==='function'||typeof value==='symbol')throw new Error('Ungültige IPC-Daten.');return value;});
    this.channel?.postMessage({...header,ciphertext:sodium.crypto_box_seal(new TextEncoder().encode(payload),recipient)});
   }else this.channel?.postMessage(header);
  }).catch(()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));});
 }
 private async receive(data:PeerMessage):Promise<void>{
  if(this.closed||data===null||typeof data!=='object'||data.version!==2||data.profileId!==this.profileId||typeof data.sender!=='string'||data.sender===this.clientId||!['*',this.clientId].includes(data.target))return;
  const keys=await this.keys;if(this.closed)return;
  if(!Array.isArray(data.publicKey)||data.publicKey.length!==32||data.publicKey.some(value=>!Number.isInteger(value)||value<0||value>255))return;
  if(this.peers.size>=64&&!this.peers.has(data.sender))return;
  this.peers.set(data.sender,new Uint8Array(data.publicKey));
  if(data.type==='request'||data.type==='result'){
   if(!(data.ciphertext instanceof Uint8Array)||data.ciphertext.byteLength>256*1024*1024)return;
   const clear=sodium.crypto_box_seal_open(data.ciphertext,keys.publicKey,keys.privateKey);
   try{const payload=JSON.parse(new TextDecoder().decode(clear)) as PeerMessage;for(const key of ['version','profileId','sender','target','type','id'] as const)if(payload[key]!==data[key])throw new Error('Fremder IPC-Kontext.');data={...data,...payload};}finally{sodium.memzero(clear);}
  }
  if(data.type==='hello'&&this.owner===this.clientId){this.post({type:'owner',target:data.sender});return;}
  if(data.type==='owner'&&!this.owning){if(this.owner!==undefined&&this.owner!==data.sender)this.rejectPeerJobs();this.owner=data.sender;this.onStatus('ready');this.resolveReady();return;}
  if(data.type==='bye'&&this.owner===data.sender){this.owner=undefined;this.rejectPeerJobs();this.onStatus('waiting');return;}
  if(data.type==='result'&&this.owner===data.sender&&typeof data.id==='number'){this.finish(data.id,data.value,data.error);return;}
  if(this.owner!==this.clientId)return;
  if(data.type==='peerClosed'){void this.sendLocal('closeRuntime',undefined,data.sender).catch(()=>{});return;}
  if(data.type!=='request'||typeof data.id!=='number'||!Number.isSafeInteger(data.id)||data.id<=0||!peerMethods.has(data.method??''))return;
  void this.sendLocal(data.method!,data.input,data.sender).then(value=>{this.post({type:'result',target:data.sender,id:data.id!,value});},error=>{const safe=error instanceof StorageFailureError?{contractVersion:2,code:error.code,commitState:error.commitState}:{contractVersion:2,code:'RESOURCE_UNAVAILABLE',commitState:'unknown'};this.post({type:'result',target:data.sender,id:data.id!,error:safe});});
 }
 private finish(id:number,value:unknown,error:unknown):void{const job=this.pending.get(id);if(job===undefined)return;this.pending.delete(id);clearTimeout(job.timer);if(error!==undefined)job.reject(decodeStorageFailure(error));else job.resolve(value);}
 private rejectPeerJobs():void{for(const [id,job] of this.pending){if(!job.peer)continue;clearTimeout(job.timer);job.reject(new StorageFailureError('COMMIT_UNKNOWN','unknown'));this.pending.delete(id);}}
 get ownership():'owner'|'follower'|'waiting'{return this.owning?'owner':this.owner===undefined?'waiting':'follower';}
 async openRuntime(input:BrowserRuntimeOpen):Promise<void>{await this.ready;await this.send('openRuntime',input);}
 async runtime(input:RuntimeRequestV2):Promise<RuntimeEventV2>{await this.ready;return await this.send('runtime',input) as RuntimeEventV2;}
 async runtimePage(offset:number,limit:number):Promise<RuntimePageV2>{await this.ready;return await this.send('runtimePage',{offset,limit}) as RuntimePageV2;}
 async closeRuntime():Promise<void>{await this.ready;await this.send('closeRuntime',undefined);}
 async rebuildProjections(spaceId:UUID):Promise<void>{await this.ready;await this.send('rebuild',spaceId);}
 async port(request:LocalPortRequestV2):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('port',request) as LocalPortOutcomeV2;}
 async commit(request:LocalCommitRequest):Promise<BrowserCommitOutcome>{await this.ready;return await this.send('commit',request) as BrowserCommitOutcome;}
 async lookup(identity:LocalOperationIdentity):Promise<BrowserReceiptLookup>{await this.ready;return await this.send('lookup',identity) as BrowserReceiptLookup;}
 async transactions(query:TransactionIndexQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('transactions',query) as LocalPortOutcomeV2;}
 async pendingOperations(query:PendingIndexQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('pending',query) as LocalPortOutcomeV2;}
 async importedTransactions(query:ImportSourceQuery):Promise<LocalPortOutcomeV2>{await this.ready;return await this.send('imported',query) as LocalPortOutcomeV2;}
 async persistBackup(input:BrowserBackupInput):Promise<EncryptedBackupReceipt>{await this.ready;return await this.send('persistBackup',input) as EncryptedBackupReceipt;}
 async readBackup(receipt:EncryptedBackupReceipt):Promise<BrowserCiphertext>{await this.ready;return await this.send('readBackup',receipt) as BrowserCiphertext;}
 async close():Promise<void>{
  if(this.closed)return;
  if(this.owning&&this.worker!==undefined){try{await this.sendLocal('close',undefined,this.clientId);}finally{this.stop(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));}}
  else{this.post({type:'peerClosed',target:this.owner??'*'});this.stop(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));}
 }
 private send(method:string,input:unknown):Promise<unknown>{
  if(this.worker!==undefined)return this.sendLocal(method,input,this.clientId);
  if(this.closed||this.owner===undefined)return Promise.reject(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
  return this.request(true,(id)=>{this.post({type:'request',target:this.owner!,id,method,input});});
 }
 private sendLocal(method:string,input:unknown,clientId:string):Promise<unknown>{
  if(this.closed||this.worker===undefined)return Promise.reject(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
  return this.request(false,(id)=>{this.worker!.postMessage({id,method,input,profileId:this.profileId,clientId});});
 }
 private request(peer:boolean,deliver:(id:number)=>void):Promise<unknown>{
  if(this.pending.size>=64)return Promise.reject(new StorageFailureError('RESOURCE_UNAVAILABLE','notCommitted'));
  return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.stop(new StorageFailureError('COMMIT_UNKNOWN','unknown'));},30_000);this.pending.set(id,{resolve,reject,timer,peer});try{deliver(id);}catch{clearTimeout(timer);this.pending.delete(id);reject(new StorageFailureError('WRITE_FAILED','notCommitted'));}});
 }
 private stop(error:unknown):void{
  if(this.closed)return;if(this.owning)this.post({type:'bye',target:'*'});
  this.closed=true;this.abort.abort();this.worker?.terminate();this.worker=undefined;this.channel?.close();void this.keys.then(keys=>sodium.memzero(keys.privateKey));
  for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(error);}this.pending.clear();this.release();
 }
}
interface PeerMessage{version:2;profileId:UUID;sender:string;target:string;type:'hello'|'owner'|'request'|'result'|'bye'|'peerClosed';publicKey?:number[];ciphertext?:Uint8Array;id?:number;method?:string;input?:unknown;value?:unknown;error?:unknown}
const peerMethods=new Set(['openRuntime','runtime','runtimePage','closeRuntime','rebuild','port','commit','lookup','transactions','pending','imported','persistBackup','readBackup']);
