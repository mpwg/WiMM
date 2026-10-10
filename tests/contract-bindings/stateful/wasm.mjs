// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich synthetischer Speicherport. Finanzregeln/Koordination/Krypto laufen in Rust.
export function runStatefulCase(wasm,scenario){
 const clone=value=>structuredClone(value);const context=clone(scenario.snapshot.context);let mode=scenario.fault,journal=[],writes=0;
 const rows=new Map(scenario.snapshot.aggregates.map(a=>[a.id,clone(a)]));const receipts=new Map();
 const host={
  load:()=>{if(mode==='readException')throw new Error('synthetischer Lesefehler');return ({contractVersion:mode==='badSnapshot'?1:2,context:clone(context),aggregates:[...rows.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(clone)});},
  commit:(request,started,cancelled)=>{
   writes++;if(mode==='exception')throw new Error('synthetischer Callbackfehler');
   if(cancelled)return {status:'notCommitted',error:{contractVersion:2,code:'CANCELLED',commitState:'notCommitted'}};
   if(mode==='rollback')return {status:'notCommitted',error:{contractVersion:2,code:'WRITE_FAILED',commitState:'notCommitted'}};
   for(const e of request.batch.expectedRevisions)if((rows.get(e.handle)?.revision??0)!==e.expectedRevision)return {status:'notCommitted',error:{contractVersion:2,code:'REVISION_CONFLICT',commitState:'notCommitted'}};
   const receipt=wasm.runtime_receipt_probe(request);
   for(const {handle,...aggregate}of request.batch.aggregates)rows.set(handle,clone(aggregate));receipts.set(request.identity.operationId,receipt);
   if(mode==='lateScope')context.sessionGeneration++;
   if(mode==='lost'){mode='normal';return {status:'unknown',identity:request.identity};}
   if(mode==='badReceipt'){mode='normal';return {status:'committed',receipt:{...receipt,contentHash:'0'.repeat(64)}};}
   return {status:'committed',receipt};
  },
  lookup:identity=>receipts.get(identity.operationId)??null,
  journalLoad:()=>mode==='journalCorrupt'?[0]:clone(journal),journalSave:bytes=>{if(journal.length)return false;journal=clone(bytes);return true;},journalClear:bytes=>{if(JSON.stringify(journal)!==JSON.stringify(bytes))return false;journal=[];return true;},
  seal:request=>Array.from(wasm.seal_runtime_probe(request)),unseal:bytes=>wasm.unseal_runtime_probe(new Uint8Array(bytes)),current:()=>clone(context),cancelled:()=>mode==='cancelled'
 };
 const session=new wasm.RuntimeSessionV2(scenario.snapshot.context,scenario.mode,host);
 const events=scenario.actions.map(action=>session.invoke(action));let pages=[];
 try{for(let offset=0;;offset+=100){const value=session.page(offset,100);pages.push(value);if(value.aggregates.length<100)break;}}catch(e){if(e.contractVersion!==2||e.code!=='INVALID_COMMAND')throw e;pages=[];}
 const page=pages[0]??null;
 events.push(session.shutdown());events.push(session.invoke(scenario.actions[0]));session.free();return {events,page,pages,writes};
}
