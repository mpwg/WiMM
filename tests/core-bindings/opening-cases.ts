// SPDX-License-Identifier: AGPL-3.0-or-later
import {createAccountWithOpening,DomainValidationError,type AccountAggregate,type P2Aggregate} from '../../packages/domain/src/index.js';
import type {UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z',context={operationId:id(100),occurredAt:time,generatedIds:[id(3)]};
const account={id:id(2),spaceId,revision:1,aggregateType:'account',createdAt:time,updatedAt:time,name:'  Giro  Österreich  ',type:'checking',onBudget:true,archived:false};
const existing={...account,id:id(20),name:'Bar'};
const tx={id:id(3),spaceId,revision:1,aggregateType:'transaction',createdAt:time,updatedAt:time,accountId:account.id,date:'2026-10-08',amount:100000,kind:'opening',clearance:'uncleared',splits:[]};
export function openingCases(){return [
 {name:'F01 Kontoeinstieg',amount:100000,all:[]},
 {name:'negativer Anfangsbestand',amount:-100000,all:[existing]},
 {name:'Nullbestand gemeinsam',amount:0,all:[existing]},
 {name:'sichere Grenze',amount:Number.MAX_SAFE_INTEGER,all:[]},
 {name:'Gesamtsaldo Überlauf',amount:Number.MAX_SAFE_INTEGER,all:[existing,{...tx,id:id(21),accountId:existing.id,amount:1}]},
 {name:'Finanzrevision fortsetzen',amount:100000,all:[existing,{id:spaceId,spaceId,revision:3,aggregateType:'financialRevision',createdAt:time,updatedAt:time}]},
 {name:'bestehendes Konto abweisen',amount:100000,all:[account]},
 ].map(s=>{
  const all=JSON.parse(JSON.stringify(s.all)) as P2Aggregate[];
  const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,command:{commandType:'account.save',aggregates:[account,{...tx,amount:s.amount}]},expectedRevisions:[{id:account.id,expectedRevision:0},{id:tx.id,expectedRevision:0}],context};
  let expected:unknown;
  try{let sequence=0;const deps={ids:{next:()=>++sequence===2?tx.id:context.operationId},clock:{now:()=>context.occurredAt}};
   const text=s.amount<0?`-${(-BigInt(s.amount))/100n}.${String((-BigInt(s.amount))%100n).padStart(2,'0')}`:`${BigInt(s.amount)/100n}.${String(BigInt(s.amount)%100n).padStart(2,'0')}`;
   const change=createAccountWithOpening(account as AccountAggregate,{amount:text,date:tx.date},{get:(id:UUID)=>all.find(a=>a.id===id),list:()=>all},deps);
   expected={contractVersion:1,status:'changed',changeSet:change};
  }catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
  return{name:`Kontoeinstieg ${s.name}`,method:'execute' as const,request,expected};
 });}
