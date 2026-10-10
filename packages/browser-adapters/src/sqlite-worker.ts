// SPDX-License-Identifier: AGPL-3.0-or-later
import type {BrowserStorage,LocalPortRequestV2,LocalOperationIdentity,LocalCommitRequest,TransactionIndexQuery,PendingIndexQuery,ImportSourceQuery,BrowserBackupInput,EncryptedBackupReceipt,BrowserRuntimeOpen,RuntimeRequestV2,BrowserRuntimePage} from '../generated/sqlite/wimm_browser_runtime.js';
let database:BrowserStorage|undefined;
// Rust-Zugriffe sind synchron. Die Kette verhindert, dass die asynchrone VFS-Öffnung von Nachrichten überholt wird.
let queue=Promise.resolve();
interface Message {id:number;method:string;profileId?:string;input:unknown}
self.onmessage=({data}:MessageEvent<Message>)=>{queue=queue.then(async()=>{
 try{
  if(data.method==='open'){
   if(database!==undefined||typeof data.profileId!=='string')throw {contractVersion:2,code:'INVALID_RESPONSE',commitState:'notCommitted'};
   // Handler steht vor asynchronen Kryptomodulen bereit; die Öffnungsnachricht bleibt in der Queue.
   const {default:init,open_browser_storage}=await import('../generated/sqlite/wimm_browser_runtime.js');
   await init({module_or_path:new URL('../generated/sqlite/wimm_browser_runtime_bg.wasm',import.meta.url)});database=await open_browser_storage(data.profileId);
   if(database.contract_version()!==2)throw {contractVersion:2,code:'UPDATE_REQUIRED',commitState:'notCommitted'};
   self.postMessage({id:data.id,value:{contractVersion:2,ready:true}});return;
  }
  if(database===undefined)throw {contractVersion:2,code:'RESOURCE_UNAVAILABLE',commitState:'notCommitted'};
  let value:unknown;
  switch(data.method){
   case 'openRuntime':database.open_runtime(data.input as BrowserRuntimeOpen);value=null;break;
   case 'runtime':value=database.runtime(data.input as RuntimeRequestV2);break;
   case 'runtimePage':value=database.runtime_page(data.input as BrowserRuntimePage);break;
   case 'closeRuntime':database.close_runtime();value=null;break;
   case 'rebuild':database.rebuild_projection_cache(data.input as string);value=null;break;
   case 'port':value=database.port(data.input as LocalPortRequestV2);break;
   case 'commit':value=database.commit(data.input as LocalCommitRequest);break;
   case 'lookup':value=database.lookup_result(data.input as LocalOperationIdentity);break;
   case 'transactions':value=database.query_transactions(data.input as TransactionIndexQuery);break;
   case 'pending':value=database.query_pending(data.input as PendingIndexQuery);break;
   case 'imported':value=database.query_imported(data.input as ImportSourceQuery);break;
   case 'persistBackup':value=database.persist_backup(data.input as BrowserBackupInput);break;
   case 'readBackup':value=database.read_backup(data.input as EncryptedBackupReceipt);break;
   case 'close':database.close();database.free();database=undefined;value=null;break;
   default:throw {contractVersion:2,code:'INVALID_RESPONSE',commitState:'notCommitted'};
  }
  self.postMessage({id:data.id,value});
 }catch(error){
  // Keine JS-/VFS-/SQLdiagnosen oder Originaldaten über die Workergrenze.
  const safe=typeof error==='object'&&error!==null&&'contractVersion'in error&&'code'in error&&'commitState'in error
   ?error:{contractVersion:2,code:'RESOURCE_UNAVAILABLE',commitState:'unknown'};
  self.postMessage({id:data.id,error:safe});
 }
}).catch(()=>{self.postMessage({id:data.id,error:{contractVersion:2,code:'RESOURCE_UNAVAILABLE',commitState:'unknown'}});});};
