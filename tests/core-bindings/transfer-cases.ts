// SPDX-License-Identifier: AGPL-3.0-or-later
import {saveTransfer,deleteTransfer,createChangeSet,DomainValidationError,type TransferAggregate,type TransactionAggregate,type AccountAggregate,type CategoryAggregate,type CategoryGroupAggregate,type P2Aggregate} from '../../packages/domain/src/index.js';
import type {UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),now='2026-10-08T12:00:00Z',context={operationId:id(100),occurredAt:'2026-10-08T13:00:00Z',generatedIds:[]};
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:now,updatedAt:now});
const account={...meta(2),aggregateType:'account' as const,name:'Giro',type:'checking',onBudget:true,archived:false};
const second={...account,...meta(3),name:'Extern'};
const group={...meta(4),aggregateType:'categoryGroup' as const,name:'Ausgaben',kind:'expense',sortOrder:0,archived:false};
const category={...meta(5),aggregateType:'category' as const,name:'Abgang',groupId:group.id,sortOrder:0,archived:false};
const transfer={...meta(6),aggregateType:'transfer' as const,date:'2026-10-08',sourceAccountId:account.id,targetAccountId:second.id,sourceTransactionId:id(7),targetTransactionId:id(8),amount:20000};
const source={...meta(7),aggregateType:'transaction' as const,accountId:account.id,date:transfer.date,amount:-transfer.amount,kind:'transfer',transferId:transfer.id,clearance:'cleared',splits:[]};
const target={...source,...meta(8),accountId:second.id,amount:transfer.amount};
type Scenario={name:string;sourceOn:boolean;targetOn:boolean;budget?:boolean;release?:boolean;deleting?:boolean;change?:boolean;bad?:string};
const scenarios:Scenario[]=[];
for(const sourceOn of [false,true])for(const targetOn of [false,true]){
 scenarios.push({name:`Budget ${sourceOn}/${targetOn} korrekt`,sourceOn,targetOn,budget:sourceOn&&!targetOn,release:!sourceOn&&targetOn});
 scenarios.push({name:`Budget ${sourceOn}/${targetOn} ändern`,sourceOn,targetOn,budget:sourceOn&&!targetOn,release:!sourceOn&&targetOn,change:true});
 scenarios.push({name:`Budget ${sourceOn}/${targetOn} löschen`,sourceOn,targetOn,budget:sourceOn&&!targetOn,release:!sourceOn&&targetOn,deleting:true});
}
for(const bad of ['kein Budgetabgang','falsche Kategorie','Freigabe fehlt','Freigabe unzulässig','Kategorie unzulässig','Betrag null','Betrag negativ','gleiche Konten','Seitenbetrag','Seitendatum','Quell-ID','Quellkonto','gesperrte Quelle','gespeicherte Sperre','stale Revision','fehlende Mutationserwartung','Überlauf Kontoanker','Überlauf Finanzrevision'])scenarios.push({name:bad,sourceOn:true,targetOn:true,bad});
export function transferCases(){return scenarios.map(s=>{
 let a={...account,onBudget:s.sourceOn},b={...second,onBudget:s.targetOn};let t: typeof transfer & {budgetCategoryId?:UUID;budgetRelease?:boolean}={...transfer,...(s.budget?{budgetCategoryId:category.id}:{}),...(s.release?{budgetRelease:true}:{})};let x={...source,clearance:source.clearance as 'cleared'|'reconciled'},y={...target};
 if(s.bad==='kein Budgetabgang'||s.bad==='falsche Kategorie'){b.onBudget=false;if(s.bad==='falsche Kategorie')t.budgetCategoryId=category.id;}
 if(s.bad==='Freigabe fehlt')a.onBudget=false;
 if(s.bad==='Freigabe unzulässig')t.budgetRelease=true;
 if(s.bad==='Kategorie unzulässig')t.budgetCategoryId=category.id;
 if(s.bad==='Betrag null'){t.amount=0;x.amount=0;y.amount=0;}
 if(s.bad==='Betrag negativ')t.amount=-1;
 if(s.bad==='gleiche Konten')t.targetAccountId=a.id;
 if(s.bad==='Seitenbetrag')y.amount++;
 if(s.bad==='Seitendatum')y.date='2026-10-09';
 if(s.bad==='Quell-ID')x.transferId=id(99);
 if(s.bad==='Quellkonto')x.accountId=b.id;
 if(s.bad==='gesperrte Quelle')x.clearance='reconciled';
 if(s.bad==='Überlauf Kontoanker')a.revision=Number.MAX_SAFE_INTEGER;
 let all:P2Aggregate[]=[a,b,s.bad==='falsche Kategorie'?{...group,kind:'income'}:group,category];
 if(s.deleting||s.change||s.bad==='gespeicherte Sperre'){all.push({...transfer,...(s.budget?{budgetCategoryId:category.id}:{}),...(s.release?{budgetRelease:true}:{})},{...source,...(s.bad==='gespeicherte Sperre'?{clearance:'reconciled'}:{})},target);}
 if(s.change){t.revision++;x.revision++;y.revision++;}
 if(s.bad==='Überlauf Finanzrevision')all.push({...meta(1),aggregateType:'financialRevision',revision:Number.MAX_SAFE_INTEGER});
 const expectations=[{id:t.id,expectedRevision:s.deleting?t.revision:t.revision-1},{id:x.id,expectedRevision:s.deleting?x.revision:x.revision-1},{id:y.id,expectedRevision:s.deleting?y.revision:y.revision-1},{id:a.id,expectedRevision:a.revision},{id:b.id,expectedRevision:b.revision},...(t.budgetCategoryId?[{id:category.id,expectedRevision:category.revision},{id:group.id,expectedRevision:group.revision}]:[])];
 const requestExpected=s.bad==='stale Revision'?expectations.map((e,n)=>n===3?{...e,expectedRevision:0}:e):s.bad==='fehlende Mutationserwartung'?expectations.slice(1):expectations;
 const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,command:s.deleting?{commandType:'transfer.delete',aggregateId:t.id}:{commandType:'transfer.save',aggregates:[t,x,y]},expectedRevisions:requestExpected,context};
 let expected:unknown;
 try{
 const heads={get:(id:UUID)=>all.find(v=>v.id===id),list:()=>all},deps={ids:{next:()=>context.operationId},clock:{now:()=>context.occurredAt}};
 const input={spaceId,transfer:t as TransferAggregate,source:x as TransactionAggregate,target:y as TransactionAggregate,sourceAccount:a as AccountAggregate,targetAccount:b as AccountAggregate,...(t.budgetCategoryId?{budgetCategory:category as CategoryAggregate,budgetGroup:all[2] as CategoryGroupAggregate}:{})};
 const change=s.deleting?deleteTransfer(input,heads,deps):saveTransfer(input,heads,deps);
 // Explizite K01-Request-CAS-Erwartungen werden zusätzlich zur Handlerreferenz geprüft.
 if(s.bad==='stale Revision'||s.bad==='fehlende Mutationserwartung')createChangeSet({spaceId,commandType:s.deleting?'transfer.delete':'transfer.save',expectedRevisions:requestExpected,mutations:change.aggregates.map(aggregate=>({aggregate}))},heads,deps);
 expected={contractVersion:1,status:'changed',changeSet:change};
 }catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
 return{name:`Transfer ${s.name}`,method:'execute' as const,request,expected};
 });}
