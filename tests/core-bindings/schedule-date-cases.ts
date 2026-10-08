// SPDX-License-Identifier: AGPL-3.0-or-later
import {dueDates,DomainValidationError,type ScheduleAggregate} from '../../packages/domain/src/index.js';
import {coreCalculationRequestSchema,type UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`d0000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z';
const base:ScheduleAggregate={id:id(2),spaceId,revision:1,createdAt:time,updatedAt:time,aggregateType:'schedule',startDate:'2026-01-31',frequency:'monthly',interval:1,enabled:true,template:{accountId:id(3),amount:-1000,kind:'normal',clearance:'cleared',splits:[{id:id(4),categoryId:id(5),amount:-1000}]}};
const cases:{name:string;schedule:ScheduleAggregate;through:string}[]=[];
for(const frequency of ['weekly','monthly','yearly'] as const)for(const interval of [1,2,13,Number.MAX_SAFE_INTEGER]){
 cases.push({name:`${frequency} Intervall ${interval}`,schedule:{...base,frequency,interval},through:'2029-12-31'});
}
for(const startDate of ['0000-01-31','0000-02-29','0099-12-31','1900-01-31','2000-02-29','2028-02-29','9999-12-31'])for(const frequency of ['weekly','monthly','yearly'] as const){
 cases.push({name:`${frequency} Start ${startDate}`,schedule:{...base,startDate,frequency},through:startDate.startsWith('9999')?'9999-12-31':`${String(Number(startDate.slice(0,4))+3).padStart(4,'0')}-12-31`});
}
cases.push({name:'deaktiviert',schedule:{...base,enabled:false},through:'2029-12-31'});
cases.push({name:'begrenzt inklusive Enddatum',schedule:{...base,endDate:'2026-03-31'},through:'2029-12-31'});
cases.push({name:'vor Startdatum',schedule:base,through:'2026-01-30'});
cases.push({name:'Enddatum vor Start',schedule:{...base,endDate:'2026-01-30'},through:'2029-12-31'});
cases.push({name:'Intervall null',schedule:{...base,interval:0},through:'2029-12-31'});
cases.push({name:'Intervall unsicher',schedule:{...base,interval:Number.MAX_SAFE_INTEGER+1},through:'2029-12-31'});
cases.push({name:'mehr als hunderttausend Fälligkeiten',schedule:{...base,startDate:'0000-01-01',frequency:'weekly'},through:'9999-12-31'});
export function scheduleDateCases(){return cases.map(s=>{
 const request={contractVersion:1,domainSchemaVersion:1,spaceId,calculationType:'schedule.dueDates',aggregates:[s.schedule],scheduleId:base.id,through:s.through};let expected:unknown;
 const shapeValid=coreCalculationRequestSchema.safeParse(request).success;
 try{if(!shapeValid)throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');expected={contractVersion:1,status:'dueDates',dates:dueDates(s.schedule,s.through)};}
 catch(e){if(!(e instanceof DomainValidationError))throw e;expected={contractVersion:1,status:'rejected',error:{code:e.code,message:e.message}};}
 return{name:`Fälligkeiten ${s.name}`,method:'calculate' as const,request:shapeValid?request:JSON.stringify(request),expected};
});}
