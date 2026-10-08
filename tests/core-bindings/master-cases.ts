// SPDX-License-Identifier: AGPL-3.0-or-later
import { DomainValidationError,saveAccount,archiveAccount,saveCategoryGroup,saveCategory,archiveCategory,savePayee,reviseAggregate,type P2Aggregate,type AccountAggregate,type CategoryGroupAggregate,type CategoryAggregate,type PayeeAggregate } from '../../packages/domain/src/index.js';
import { coreCommandRequestSchema,type UUID } from '../../packages/contracts/src/index.js';
const id=(n:number)=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z',context={operationId:id(100),occurredAt:time,generatedIds:[]};
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:time,updatedAt:time});
const account={...meta(2),aggregateType:'account',name:'Giro',type:'checking',onBudget:true,archived:false};
const group={...meta(3),aggregateType:'categoryGroup',name:'Ausgaben',kind:'expense',sortOrder:0,archived:false};
const category={...meta(4),aggregateType:'category',name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};
const payee={...meta(5),aggregateType:'payee',name:'Prüfladen',aliases:['Handel'],archived:false};
type Input={name:string;type:string;current:unknown[];mutation?:unknown;target?:UUID;expected:{id:UUID;expectedRevision:number}[]};
const inputs:Input[]=[];
for(const [type,aggregate] of [['account.save',account],['categoryGroup.save',group],['category.save',category],['payee.save',payee]] as const) {
 const isCategory=type==='category.save'; const current=isCategory?[group]:[];const refs=isCategory?[{id:group.id,expectedRevision:1}]:[];
 inputs.push({name:`${type} neu`,type,current,mutation:{...aggregate,name:'  Cafe\u0301   Österreich  '},expected:[{id:aggregate.id,expectedRevision:0},...refs]});
 inputs.push({name:`${type} ändern`,type,current:[...current,aggregate],mutation:{...aggregate,revision:2,name:'Geändert'},expected:[{id:aggregate.id,expectedRevision:1},...refs]});
 inputs.push({name:`${type} stale CAS`,type,current:[...current,aggregate],mutation:{...aggregate,revision:2},expected:[{id:aggregate.id,expectedRevision:0},...refs]});
 inputs.push({name:`${type} fehlende Revision`,type,current,mutation:aggregate,expected:refs});
 inputs.push({name:`${type} falsche Neurevision`,type,current,mutation:{...aggregate,revision:2},expected:[{id:aggregate.id,expectedRevision:0},...refs]});
 inputs.push({name:`${type} falscher Revisionsschritt`,type,current:[...current,aggregate],mutation:{...aggregate,revision:3},expected:[{id:aggregate.id,expectedRevision:1},...refs]});
 inputs.push({name:`${type} doppelte Erwartung`,type,current,mutation:aggregate,expected:[{id:aggregate.id,expectedRevision:0},{id:aggregate.id,expectedRevision:0},...refs]});
 inputs.push({name:`${type} Revisionsüberlauf`,type,current:[...current,{...aggregate,revision:Number.MAX_SAFE_INTEGER}],mutation:{...aggregate,revision:Number.MAX_SAFE_INTEGER},expected:[{id:aggregate.id,expectedRevision:Number.MAX_SAFE_INTEGER},...refs]});
}
for(const [type,aggregate] of [['account.archive',account],['category.archive',category]] as const) {
 const current=type==='category.archive'?[group,aggregate]:[aggregate];const refs=type==='category.archive'?[{id:group.id,expectedRevision:1}]:[];
 inputs.push({name:`${type} historisch`,type,current,target:aggregate.id,expected:[{id:aggregate.id,expectedRevision:1},...refs]});
 inputs.push({name:`${type} fehlende Erwartung`,type,current,target:aggregate.id,expected:refs});
}
inputs.push({name:'Kreditkonto im Budget',type:'account.save',current:[],mutation:{...account,type:'credit'},expected:[{id:account.id,expectedRevision:0}]});
inputs.push({name:'Fremder Bereich',type:'account.save',current:[],mutation:{...account,spaceId:id(99)},expected:[{id:account.id,expectedRevision:0}]});
inputs.push({name:'Reservierte Finanzrevision',type:'account.save',current:[],mutation:{...account,id:spaceId},expected:[{id:spaceId,expectedRevision:0}]});
inputs.push({name:'Historisches CAS-Ziel fehlt',type:'account.save',current:[],mutation:account,expected:[{id:account.id,expectedRevision:1}]});
inputs.push({name:'Aliasnormalisierung',type:'payee.save',current:[],mutation:{...payee,aliases:['  Cafe\u0301   Österreich  ','Straße']},expected:[{id:payee.id,expectedRevision:0}]});
inputs.push({name:'Doppelte Aliasnormalform',type:'payee.save',current:[],mutation:{...payee,aliases:['Café','Cafe\u0301']},expected:[{id:payee.id,expectedRevision:0}]});
inputs.push({name:'Kategorie ohne Gruppenrevision',type:'category.save',current:[group],mutation:category,expected:[{id:category.id,expectedRevision:0}]});
inputs.push({name:'Neue Kategorie an Tombstone',type:'category.save',current:[{...group,deletedAt:time}],mutation:category,expected:[{id:category.id,expectedRevision:0},{id:group.id,expectedRevision:1}]});
inputs.push({name:'Systemkategorie umwidmen',type:'category.save',current:[group,{...category,system:'uncategorized'}],mutation:{...category,revision:2},expected:[{id:category.id,expectedRevision:1},{id:group.id,expectedRevision:1}]});
inputs.push({name:'Systemkategorie archivieren',type:'category.archive',current:[group,{...category,system:'uncategorized'}],target:category.id,expected:[{id:category.id,expectedRevision:1},{id:group.id,expectedRevision:1}]});
export function masterCases() {
 return inputs.map(input=>{
  const all=JSON.parse(JSON.stringify(input.current)) as P2Aggregate[];
  const command=input.target===undefined?{commandType:input.type,aggregates:[input.mutation]}:{commandType:input.type,aggregateId:input.target};
  const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,command,expectedRevisions:input.expected,context};
  let expected:unknown;
  try {
   if (!coreCommandRequestSchema.safeParse(request).success) throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');
   const deps={ids:{next:()=>context.operationId},clock:{now:()=>context.occurredAt}};
   const heads={get:(id:UUID)=>all.find(a=>a.id===id),list:()=>all};
   const a=input.target===undefined?input.mutation as P2Aggregate:reviseAggregate({...all.find(a=>a.id===input.target)!,archived:true},deps);
   const inputCommand={spaceId,commandType:input.type,expectedRevisions:input.expected,mutations:[{aggregate:a}]};
   const change=input.type==='account.save'?saveAccount({...inputCommand,commandType:'account.save',mutations:[{aggregate:a as AccountAggregate}]},heads,deps):input.type==='account.archive'?archiveAccount({...inputCommand,commandType:'account.archive',mutations:[{aggregate:a as AccountAggregate}]},heads,deps):input.type==='categoryGroup.save'?saveCategoryGroup({...inputCommand,commandType:'categoryGroup.save',mutations:[{aggregate:a as CategoryGroupAggregate}]},heads,deps):input.type==='category.save'?saveCategory({...inputCommand,commandType:'category.save',mutations:[{aggregate:a as CategoryAggregate}]},heads,deps):input.type==='category.archive'?archiveCategory({...inputCommand,commandType:'category.archive',mutations:[{aggregate:a as CategoryAggregate}]},heads,deps):savePayee({...inputCommand,commandType:'payee.save',mutations:[{aggregate:a as PayeeAggregate}]},heads,deps);
   expected={contractVersion:1,status:'changed',changeSet:change};
  }catch(error){if(!(error instanceof DomainValidationError))throw error;expected={contractVersion:1,status:'rejected',error:{code:error.code,message:error.message}};}
  return {name:`Stammdaten ${input.name}`,method:'execute' as const,request,expected};
 });
}
