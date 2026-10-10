// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich CPU-Funktions-/Dauermetadaten des synthetischen Prüfworkers, keine Heap-/Payloadaufnahme.
import type {Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
export async function profileSqliteWorker(page:Page){
 const session=await page.context().newCDPSession(page);let next=0;
 const pending=new Map<number,{resolve(value:unknown):void;reject(error:unknown):void}>();
 const started=new Map<string,Promise<void>>();const targets=new Map<string,string>();
 const info=await session.send('Target.getTargetInfo');const contextId=info.targetInfo.browserContextId;
 session.on('Target.receivedMessageFromTarget',event=>{const message=JSON.parse(event.message) as {id:number;result?:unknown;error?:unknown};const job=pending.get(message.id);if(job===undefined)return;pending.delete(message.id);if(message.error!==undefined)job.reject(new Error('CPU-Profilierkommando abgewiesen.'));else job.resolve(message.result);});
 const command=(target:string,method:string,params:Record<string,unknown>={})=>new Promise<unknown>((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});void session.send('Target.sendMessageToTarget',{sessionId:target,message:JSON.stringify({id,method,params})}).catch(reject);});
 const discover=(event:{targetInfo:{targetId:string;type:string;url:string;browserContextId?:string}})=>{
  if(event.targetInfo.browserContextId!==contextId||event.targetInfo.type!=='worker'||!event.targetInfo.url.includes('sqlite-worker.ts'))return;
  const target=event.targetInfo.targetId;
  if(started.has(target))return;
  started.set(target,(async()=>{const attached=await session.send('Target.attachToTarget',{targetId:target,flatten:false});await command(attached.sessionId,'Profiler.enable');await command(attached.sessionId,'Debugger.enable');await command(attached.sessionId,'Profiler.start');targets.set(target,attached.sessionId);})());
 };
 session.on('Target.targetCreated',discover);session.on('Target.targetInfoChanged',discover);
 await session.send('Target.setDiscoverTargets',{discover:true});
 return async(path:string)=>{
  await Promise.all(started.values());
  const profiles=[];for(const target of targets.values()){const result=await command(target,'Profiler.stop') as {profile:{nodes:{callFrame:{scriptId:string;url:string}}[]}};const ids=new Set(result.profile.nodes.filter(node=>node.callFrame.url.includes('wimm_browser_runtime.js')).map(node=>node.callFrame.scriptId));const sources:Record<string,unknown>={};for(const id of ids)sources[id]=await command(target,'Debugger.getScriptSource',{scriptId:id});profiles.push({...result,sources});}
  if(profiles.length===0)throw new Error('Kein tatsächlicher SQLite-Worker im CPUprofil.');await writeFile(path,JSON.stringify(profiles));await session.detach();
 };
}
