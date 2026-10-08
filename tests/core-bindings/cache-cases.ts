// SPDX-License-Identifier: AGPL-3.0-or-later
import {validateFinancialState,validateFinancialProjectionCache,rebuildFinancialProjections,DomainValidationError,type TransactionAggregate,type CategoryAggregate,type CategoryGroupAggregate,type P2Aggregate} from '../../packages/domain/src/index.js';
import type {UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`11000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z';const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:time,updatedAt:time});
const account={...meta(2),aggregateType:'account' as const,name:'Giro',type:'checking' as const,onBudget:true,archived:false};
const group:CategoryGroupAggregate={...meta(3),aggregateType:'categoryGroup',name:'Ausgaben',kind:'expense',sortOrder:0,archived:false};const incomeGroup={...group,...meta(4),kind:'income' as const};
const category:CategoryAggregate={...meta(5),aggregateType:'category',name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};const incomeCategory={...category,...meta(6),groupId:incomeGroup.id};
const opening:TransactionAggregate={...meta(10),aggregateType:'transaction',accountId:account.id,date:'2026-10-08',amount:100000,kind:'opening',clearance:'cleared',splits:[]};
const expense:TransactionAggregate={...opening,...meta(11),kind:'normal',amount:-10000,splits:[{id:id(12),categoryId:category.id,amount:-10000}]};const income={...expense,...meta(13),amount:20000,splits:[{id:id(14),categoryId:incomeCategory.id,amount:20000}]};
const all:P2Aggregate[]=[account,group,incomeGroup,category,incomeCategory,opening,expense,income];
export function cacheCases(){const expected=rebuildFinancialProjections({transactions:[opening,expense,income],categories:[category,incomeCategory],categoryGroups:[group,incomeGroup]});
 const scenarios:[string,{kind:string;key:string;payload:unknown}[]][]=[
 ['F01 Saldo',[{kind:'accountBalance',key:account.id,payload:{balance:110000}}]],['Legacybalance',[{kind:'balance',key:account.id,payload:110000}]],
 ['falscher Saldo',[{kind:'balance',key:account.id,payload:110001}]],['fremdes Konto',[{kind:'balance',key:id(99),payload:0}]],
 ['F01 Verbrauch',[{kind:'consumption',key:'all',payload:expected.consumption}]],['Monatsverbrauch',[{kind:'consumption',key:'2026-10',payload:expected.consumption}]],
 ['Categoryreihenfolge irrelevant',[{kind:'consumption',key:'all',payload:{...expected.consumption,categories:[...expected.consumption.categories].reverse()}}]],
 ['falscher Verbrauch',[{kind:'consumption',key:'all',payload:{...expected.consumption,expense:10001}}]],['doppelte Kategorie',[{kind:'consumption',key:'all',payload:{...expected.consumption,categories:[expected.consumption.categories[0],expected.consumption.categories[0]]}}]],
 ['ungültiger Monatskey',[{kind:'consumption',key:'2026-13',payload:expected.consumption}]],['unbekannter Cache',[{kind:'foreign',key:'all',payload:0}]],
 ];return scenarios.map(([name,projections])=>{let result:unknown;try{validateFinancialState(all,spaceId);validateFinancialProjectionCache(all,projections);result={contractVersion:1,status:'valid'};}catch(e){if(!(e instanceof DomainValidationError))throw e;result={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}return{name:`Projektionscache ${name}`,method:'cache' as const,request:{contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,projections},expected:result};});}
