// SPDX-License-Identifier: AGPL-3.0-or-later
import {confirmReconciliation,unlockFinanceSelection,DomainValidationError,type P2Aggregate,type TransactionAggregate,type ReconciliationAggregate} from '../../packages/domain/src/index.js';
import type {UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z',context={operationId:id(100),occurredAt:'2026-10-08T13:00:00Z',generatedIds:[id(30)]};
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:time,updatedAt:time});
const account={...meta(2),aggregateType:'account' as const,name:'Giro',type:'checking' as const,onBudget:true,archived:false};
const group={...meta(3),aggregateType:'categoryGroup' as const,name:'Ausgaben',kind:'expense' as const,sortOrder:0,archived:false};
const category={...meta(4),aggregateType:'category' as const,name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};
const opening:TransactionAggregate={...meta(10),aggregateType:'transaction',accountId:account.id,date:'2026-10-08',amount:100000,kind:'opening',clearance:'cleared',splits:[]};
const expense:TransactionAggregate={...opening,...meta(11),kind:'normal',amount:-10000,splits:[{id:id(12),categoryId:category.id,amount:-10000}]};
const base:P2Aggregate[]=[account,group,category,opening,expense];
const rec:ReconciliationAggregate={...meta(20),aggregateType:'reconciliation',accountId:account.id,statementDate:opening.date,statementBalance:90000,transactionIds:[opening.id,expense.id]};
const scenarios:{name:string;all:P2Aggregate[];selected:UUID[];balance:number;date?:string;unlock?:boolean;recId?:UUID}[]=[
 {name:'F01 bestätigen',all:base,selected:rec.transactionIds as UUID[],balance:90000},
 {name:'falsche Differenz',all:base,selected:rec.transactionIds as UUID[],balance:90001},
 {name:'doppelte Auswahl',all:base,selected:[opening.id,opening.id],balance:200000},
 {name:'zukünftiges Datum',all:base,selected:rec.transactionIds as UUID[],balance:90000,date:'2026-10-07'},
 {name:'gelöschte Buchung',all:base.map(a=>a.id===expense.id?{...a,deletedAt:time}:a),selected:rec.transactionIds as UUID[],balance:90000},
 {name:'anderes Konto',all:base.map(a=>a.id===expense.id?{...a,accountId:id(99)}:a),selected:rec.transactionIds as UUID[],balance:90000},
 {name:'bestätigten Ausgangssaldo verwenden',all:base.map(a=>a.id===opening.id?{...opening,clearance:'reconciled'}:a),selected:[expense.id],balance:90000},
 {name:'bereits abgeglichene Auswahl',all:base.map(a=>a.id===opening.id?{...opening,clearance:'reconciled'}:a),selected:[opening.id],balance:100000},
 {name:'Revisionüberlauf Auswahl',all:base.map(a=>a.id===opening.id?{...opening,revision:Number.MAX_SAFE_INTEGER}:a),selected:rec.transactionIds as UUID[],balance:90000},
 {name:'Summenzwischenüberlauf',all:base.map(a=>a.id===opening.id?{...opening,amount:Number.MAX_SAFE_INTEGER}:a.id===expense.id?{...opening,...meta(11),amount:1}:a),selected:rec.transactionIds as UUID[],balance:0},
 {name:'einfachen Abgleich entsperren',all:[...base.map(a=>['transaction'].includes(a.aggregateType)?{...a,clearance:'reconciled'}:a),rec],selected:[],balance:0,unlock:true,recId:rec.id},
 {name:'doppelte gespeicherte Abgleichreferenz',all:[...base.map(a=>a.id===opening.id?{...opening,clearance:'reconciled'}:a),{...rec,transactionIds:[opening.id,opening.id]} as ReconciliationAggregate],selected:[],balance:0,unlock:true,recId:rec.id},
 {name:'fehlende Abgleichbuchung',all:[...base.filter(a=>a.id!==expense.id).map(a=>a.id===opening.id?{...opening,clearance:'reconciled'}:a),rec],selected:[],balance:0,unlock:true,recId:rec.id},
];
// Drei verbundene Abgleiche, zwei Transfers: Einstieg über normale Buchung muss die gesamte Kette umfassen.
const accounts=[account,{...account,...meta(5)},{...account,...meta(6)}];
const transfer1={...meta(40),aggregateType:'transfer' as const,date:opening.date,sourceAccountId:account.id,targetAccountId:id(5),sourceTransactionId:id(41),targetTransactionId:id(42),amount:1000};
const transfer2={...transfer1,...meta(43),sourceAccountId:id(5),targetAccountId:id(6),sourceTransactionId:id(44),targetTransactionId:id(45),amount:500};
const side=(n:number,account:UUID,transfer:UUID,amount:number):TransactionAggregate=>({...opening,...meta(n),accountId:account,kind:'transfer',transferId:transfer,amount,clearance:'reconciled'});
const chainTx=[{...opening,amount:0,clearance:'reconciled' as const},side(41,account.id,transfer1.id,-1000),side(42,id(5),transfer1.id,1000),side(44,id(5),transfer2.id,-500),side(45,id(6),transfer2.id,500)];
const chainRec:ReconciliationAggregate[]=[{...rec,...meta(50),transactionIds:[opening.id,id(41)],statementBalance:-1000},{...rec,...meta(51),accountId:id(5),transactionIds:[id(42),id(44)],statementBalance:500},{...rec,...meta(52),accountId:id(6),transactionIds:[id(45)],statementBalance:500}];
const chain:P2Aggregate[]=[...accounts,transfer1,transfer2,...chainTx,...chainRec];
scenarios.push({name:'vollständige Transfer-/Abgleichkette',all:chain,selected:[],balance:0,unlock:true,recId:chainRec[0]!.id});
scenarios.push({name:'beschädigte Transferkette',all:chain.filter(a=>a.id!==id(45)),selected:[],balance:0,unlock:true,recId:chainRec[0]!.id});
export function reconciliationCases(){return scenarios.map(s=>{
 const date=s.date??opening.date, generated=s.unlock?[]:context.generatedIds;
 const rec= {...meta(30),createdAt:context.occurredAt,updatedAt:context.occurredAt,aggregateType:'reconciliation' as const,accountId:account.id,statementDate:date,statementBalance:s.balance,transactionIds:s.selected};
 let expected:unknown;let change;
 try{const heads={get:(id:UUID)=>s.all.find(a=>a.id===id),list:()=>s.all},deps={ids:{next:()=>context.operationId},clock:{now:()=>context.occurredAt}};
 if(s.unlock){const group=s.all.find(a=>a.id===s.recId) as ReconciliationAggregate;change=unlockFinanceSelection(spaceId,group.transactionIds[0]!,s.all,deps);}
 else {const transactions=s.selected.map(id=>s.all.find(a=>a.id===id) as TransactionAggregate);const previous=s.all.filter((a):a is TransactionAggregate=>a.aggregateType==='transaction'&&a.deletedAt===undefined&&(a as TransactionAggregate).accountId===account.id&&(a as TransactionAggregate).clearance==='reconciled'&&(a as TransactionAggregate).date<=date&&!s.selected.includes(a.id));change=confirmReconciliation({spaceId,reconciliation:rec,transactions,previousTransactions:previous},heads,deps).changeSet;}
 expected={contractVersion:1,status:'changed',changeSet:change};
 }catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
 // Erwartungen für negative Fälle stammen aus denselben unveränderten Kopfständen.
 const fallback=s.unlock?[]:[{id:rec.id,expectedRevision:0},...s.selected.map(id=>({id,expectedRevision:s.all.find(a=>a.id===id)?.revision??0})),{id:account.id,expectedRevision:account.revision}];
 const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:s.all,command:s.unlock?{commandType:'reconciliation.unlock',reconciliationId:s.recId}:{commandType:'reconciliation.confirm',accountId:account.id,statementDate:date,statementBalance:s.balance,selectedTransactionIds:s.selected},expectedRevisions:change?.expectedRevisions??fallback,context:{...context,generatedIds:generated}};
 return{name:`Abgleich ${s.name}`,method:'execute' as const,request,expected};
 });}
