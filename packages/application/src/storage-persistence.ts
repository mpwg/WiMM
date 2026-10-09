// SPDX-License-Identifier: AGPL-3.0-or-later
import type {StoragePersistenceOutcome,StoragePersistencePort} from '@wimm/contracts';
export type StoragePersistenceState=StoragePersistenceOutcome|{readonly supported:undefined;readonly status:'unknown'|'requesting'};
/** Ursprungweiter Status ohne Finanzdaten; UI beobachtet ausschließlich den tatsächlichen Portausgang. */
export class StoragePersistenceApplication{
 private value:StoragePersistenceState={supported:undefined,status:'unknown'};
 private pending:Promise<void>|undefined;
 private readonly listeners=new Set<()=>void>();
 constructor(private readonly port:StoragePersistencePort){}
 getSnapshot=():StoragePersistenceState=>this.value;
 subscribe=(listener:()=>void):(()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 private publish(value:StoragePersistenceState){this.value=value;for(const listener of this.listeners)listener();}
 start():Promise<void>{
  if(this.pending!==undefined)return this.pending;
  this.pending=Promise.resolve().then(async()=>{try{const result=await this.port.request();if(result.supported===false&&result.status==='unsupported'||result.supported===true&&['granted','denied','error'].includes(result.status))this.publish(result);else this.publish({supported:true,status:'error'});}catch{this.publish({supported:true,status:'error'});}});
  this.publish({supported:undefined,status:'requesting'});
  return this.pending;
 }
 retry():Promise<void>{if(this.value.status==='requesting')return this.pending!;this.pending=undefined;return this.start();}
}
