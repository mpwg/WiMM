// SPDX-License-Identifier: AGPL-3.0-or-later
import { DomainValidationError,saveTransaction,deleteTransaction,type TransactionAggregate,type P2Aggregate } from '../../packages/domain/src/index.js';
import {coreCommandRequestSchema,type UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),now='2026-10-08T12:00:00Z';
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:now,updatedAt:now});
const account={...meta(2),aggregateType:'account',name:'Giro',type:'checking',onBudget:true,archived:false};
const second={...account,...meta(3),name:'Bar'};
const group={...meta(4),aggregateType:'categoryGroup',name:'Ausgaben',kind:'expense',sortOrder:0,archived:false};
const category={...meta(5),aggregateType:'category',name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};
const tx={...meta(6),aggregateType:'transaction',accountId:account.id,date:'2026-10-08',amount:-1000,kind:'normal',clearance:'cleared',splits:[{id:id(7),categoryId:category.id,amount:-1000}]};
const base=[account,second,group,category];
const refs=[{id:account.id,expectedRevision:1},{id:category.id,expectedRevision:1}];
type Scenario={name:string;all:unknown[];tx:unknown;expected:{id:UUID;expectedRevision:number}[];deleting?:boolean};
const scenarios:Scenario[]=[
 {name:'F01 neue Ausgabe',all:base,tx,expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'neuer Anfangsbestand',all:base,tx:{...tx,kind:'opening',amount:100000,splits:[]},expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:1}]},
 {name:'Buchung ändern',all:[...base,tx],tx:{...tx,revision:2,note:'  Cafe\u0301  Österreich  '},expected:[{id:tx.id,expectedRevision:1},...refs]},
 {name:'Kontowechsel schützt beide Konten',all:[...base,tx],tx:{...tx,revision:2,accountId:second.id},expected:[{id:tx.id,expectedRevision:1},{id:second.id,expectedRevision:1},{id:category.id,expectedRevision:1}]},
 {name:'stale Buchungsrevision',all:[...base,tx],tx:{...tx,revision:2},expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'fehlende Kontorevision',all:base,tx,expected:[{id:tx.id,expectedRevision:0},{id:category.id,expectedRevision:1}]},
 {name:'fehlende Kategorienrevision',all:base,tx,expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:1}]},
 {name:'doppelte Erwartung',all:base,tx,expected:[{id:tx.id,expectedRevision:0},{id:tx.id,expectedRevision:0},...refs]},
 {name:'stale Konto',all:base,tx,expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:0},{id:category.id,expectedRevision:1}]},
 {name:'falscher Split',all:base,tx:{...tx,splits:[{...tx.splits[0]!,amount:-999}]},expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'Tombstone speichern',all:base,tx:{...tx,deletedAt:now},expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'Abgeglichene Buchung ändern',all:[...base,{...tx,clearance:'reconciled'}],tx:{...tx,revision:2},expected:[{id:tx.id,expectedRevision:1},...refs]},
 {name:'neue Abgleichsperre verbieten',all:base,tx:{...tx,clearance:'reconciled'},expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'Löschen erzeugt Tombstone und Anker',all:[...base,tx],tx,expected:[{id:tx.id,expectedRevision:1},...refs],deleting:true},
 {name:'Abgeglichene Buchung löschen',all:[...base,{...tx,clearance:'reconciled'}],tx:{...tx,clearance:'reconciled'},expected:[{id:tx.id,expectedRevision:1},...refs],deleting:true},
 {name:'neue Referenz an Tombstone',all:base.map(a=>a.id===category.id?{...a,deletedAt:now}:a),tx,expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'historische Referenz erhalten',all:[...base.map(a=>a.id===category.id?{...a,deletedAt:now}:a),tx],tx:{...tx,revision:2},expected:[{id:tx.id,expectedRevision:1},...refs]},
 {name:'neuer Split an Tombstone',all:[...base.map(a=>a.id===category.id?{...a,deletedAt:now}:a),tx],tx:{...tx,revision:2,splits:[{...tx.splits[0]!,id:id(99)}]},expected:[{id:tx.id,expectedRevision:1},...refs]},
 {name:'Finanzrevision fortsetzen',all:[...base,{...meta(1),aggregateType:'financialRevision',revision:4}],tx,expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'Finanzrevision Überlauf',all:[...base,{...meta(1),aggregateType:'financialRevision',revision:Number.MAX_SAFE_INTEGER}],tx,expected:[{id:tx.id,expectedRevision:0},...refs]},
 {name:'stale Finanzrevision',all:[...base,{...meta(1),aggregateType:'financialRevision',revision:4}],tx,expected:[{id:tx.id,expectedRevision:0},...refs,{id:spaceId,expectedRevision:3}]},
 {name:'stale entfernte Kategorie',all:base,tx,expected:[{id:tx.id,expectedRevision:0},...refs,{id:group.id,expectedRevision:0}]},
 {name:'Kontoanker Überlauf',all:base.map(a=>a.id===account.id?{...a,revision:Number.MAX_SAFE_INTEGER}:a),tx,expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:Number.MAX_SAFE_INTEGER},{id:category.id,expectedRevision:1}]},
];
for(const [name,all,amount] of [
 ['Kontosaldo Überlauf',[...base,{...tx,...meta(80),kind:'opening',splits:[],amount:Number.MAX_SAFE_INTEGER}],1],
 ['Gesamtsaldo Überlauf',[...base,{...tx,...meta(80),accountId:second.id,kind:'opening',splits:[],amount:Number.MAX_SAFE_INTEGER}],1]
] as const)scenarios.push({name,all:[...all],tx:{...tx,kind:'opening',splits:[],amount},expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:1}]});
const maximumOpening={...tx,...meta(80),kind:'opening' as const,splits:[],amount:Number.MAX_SAFE_INTEGER};
scenarios.push({name:'stabile Summenreihenfolge bei vorgezogener ID',all:[...base,maximumOpening,{...maximumOpening,...meta(90),amount:-1}],tx:{...tx,kind:'opening',splits:[],amount:1},expected:[{id:tx.id,expectedRevision:0},{id:account.id,expectedRevision:1}]});
export function transactionCases(){return scenarios.map(s=>{
 const all=JSON.parse(JSON.stringify(s.all)) as P2Aggregate[],candidate=JSON.parse(JSON.stringify(s.tx)) as TransactionAggregate;
 const command=s.deleting?{commandType:'transaction.delete',aggregateId:candidate.id}:{commandType:'transaction.save',aggregates:[candidate]};
 const context={operationId:id(100),occurredAt:'2026-10-08T13:00:00Z',generatedIds:[]};
 const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,command,expectedRevisions:s.expected,context};let expected:unknown;
 try{if(!coreCommandRequestSchema.safeParse(request).success)throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');
 const heads={get:(id:UUID)=>all.find(a=>a.id===id),list:()=>all},deps={ids:{next:()=>context.operationId},clock:{now:()=>context.occurredAt}};
 const change=s.deleting?deleteTransaction({spaceId,commandType:'transaction.delete',expectedRevisions:s.expected,mutations:[{aggregate:candidate}]},heads,deps):saveTransaction({spaceId,commandType:'transaction.save',expectedRevisions:s.expected,mutations:[{aggregate:candidate}]},heads,deps);
 expected={contractVersion:1,status:'changed',changeSet:change};
 }catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
 return{name:`Buchungs-CAS ${s.name}`,method:'execute' as const,request,expected};
});}
