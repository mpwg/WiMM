// SPDX-License-Identifier: AGPL-3.0-or-later
import {mergePayees,createChangeSet,DomainValidationError,type PayeeAggregate,type TransactionAggregate,type P2Aggregate} from '../../packages/domain/src/index.js';
import {coreCommandRequestSchema,type UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`c0000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z',context={operationId:id(100),occurredAt:'2026-10-08T13:00:00Z',generatedIds:[]};
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:time,updatedAt:time});
const account={...meta(2),aggregateType:'account' as const,name:'Giro',type:'checking' as const,onBudget:true,archived:false};
const target:PayeeAggregate={...meta(3),aggregateType:'payee',name:'Café',aliases:['Handel'],archived:false};
const source:PayeeAggregate={...target,...meta(4),name:'Cafe\u0301',aliases:['HANDEL','Prüfladen']};
const second:PayeeAggregate={...target,...meta(5),name:'Österreich',aliases:['prüfladen','Café']};
const group={...meta(6),aggregateType:'categoryGroup' as const,name:'Ausgaben',kind:'expense' as const,sortOrder:0,archived:false};
const category={...meta(7),aggregateType:'category' as const,name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};
const tx:TransactionAggregate={...meta(10),aggregateType:'transaction',accountId:account.id,date:'2026-10-08',amount:-1234,kind:'normal',clearance:'cleared',payeeId:source.id,note:'Originalnotiz 🏠',importReference:'Unveränderte Herkunft',splits:[{id:id(11),categoryId:category.id,amount:-1234}]};
const tx2={...tx,...meta(12),payeeId:second.id};
const base:P2Aggregate[]=[account,group,category,target,source,second,tx,tx2];
type Scenario={name:string;all:P2Aggregate[];sources:UUID[];transactions:UUID[];stale?:UUID};
const scenarios:Scenario[]=[
 {name:'deduplizierte Aliasunion und vollständige Felder',all:base,sources:[source.id,second.id],transactions:[tx2.id,tx.id]},
 {name:'einzelner Empfänger',all:base,sources:[source.id],transactions:[tx.id]},
 {name:'ohne Buchungsreferenzen',all:base.filter(a=>a.aggregateType!=='transaction'),sources:[source.id,second.id],transactions:[]},
 {name:'historischer Tombstone unverändert',all:[...base,{...tx,...meta(13),deletedAt:time}],sources:[source.id,second.id],transactions:[tx.id,tx2.id]},
 {name:'gespeicherte Finanzrevision schützen',all:[...base,{...meta(1),aggregateType:'financialRevision',revision:5}],sources:[source.id,second.id],transactions:[tx.id,tx2.id]},
 {name:'unvollständige Liste',all:base,sources:[source.id,second.id],transactions:[tx.id]},
 {name:'doppelte Quellen',all:base,sources:[source.id,source.id],transactions:[tx.id]},
 {name:'Ziel als Quelle',all:base,sources:[target.id],transactions:[]},
 {name:'doppelte Buchungsreferenz',all:base,sources:[source.id],transactions:[tx.id,tx.id]},
 {name:'unpassende Buchungsreferenz',all:base,sources:[source.id],transactions:[tx2.id]},
 {name:'abgeglichene Referenz',all:base.map(a=>a.id===tx.id?{...tx,clearance:'reconciled'}:a),sources:[source.id],transactions:[tx.id]},
 {name:'archiviertes Ziel',all:base.map(a=>a.id===target.id?{...target,archived:true}:a),sources:[source.id],transactions:[tx.id]},
 {name:'gelöschte Quelle',all:base.map(a=>a.id===source.id?{...source,deletedAt:time}:a),sources:[source.id],transactions:[tx.id]},
 {name:'fremde Quelle',all:base.map(a=>a.id===source.id?{...source,spaceId:id(99)}:a),sources:[source.id],transactions:[tx.id]},
 {name:'Alias im Quellname',all:base.map(a=>a.id===source.id?{...source,aliases:['CAFÉ']}:a),sources:[source.id],transactions:[tx.id]},
 {name:'Revisionsüberlauf Ziel',all:base.map(a=>a.id===target.id?{...target,revision:Number.MAX_SAFE_INTEGER}:a),sources:[source.id],transactions:[tx.id]},
 {name:'stale Buchungserwartung',all:base,sources:[source.id],transactions:[tx.id],stale:tx.id},
 {name:'stale Finanzrevision',all:[...base,{...meta(1),aggregateType:'financialRevision',revision:5}],sources:[source.id],transactions:[tx.id],stale:spaceId},
];
export function mergeCases(){return scenarios.map(s=>{
 const targetStored=s.all.find(a=>a.id===target.id) as PayeeAggregate;
 const sources=s.sources.map(id=>s.all.find(a=>a.id===id) as PayeeAggregate),transactions=s.transactions.map(id=>s.all.find(a=>a.id===id) as TransactionAggregate);
 const expectedRevisions=[targetStored,...sources,...transactions].map(a=>({id:a.id,expectedRevision:a.revision}));
 const guard=s.all.find(a=>a.id===spaceId);expectedRevisions.push({id:spaceId,expectedRevision:guard?.revision??0});
 if(s.stale){const e=expectedRevisions.find(e=>e.id===s.stale)!;e.expectedRevision--;}
 const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:s.all,command:{commandType:'payee.merge',targetId:target.id,sourceIds:s.sources,transactionIds:s.transactions},expectedRevisions,context};
 let expected:unknown;
 try{if(!coreCommandRequestSchema.safeParse(request).success)throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');
 const heads={get:(id:UUID)=>s.all.find(a=>a.id===id),list:()=>s.all},deps={ids:{next:()=>context.operationId},clock:{now:()=>context.occurredAt}};
 const change=mergePayees({spaceId,target:targetStored,sources,transactions},heads,deps);
 if(s.stale)createChangeSet({spaceId,commandType:'payee.merge',expectedRevisions,mutations:change.aggregates.map(aggregate=>({aggregate}))},heads,deps);
 expected={contractVersion:1,status:'changed',changeSet:change};
 }catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
 return{name:`Empfängermerge ${s.name}`,method:'execute' as const,request,expected};
 });}
