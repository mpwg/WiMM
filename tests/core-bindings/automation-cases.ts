// SPDX-License-Identifier: AGPL-3.0-or-later
import {applyRules,classifyImportCandidates,importFingerprint,saveRule,deleteRule,saveSchedule,resolveOccurrence,saveImportBatch,commitImportGroup,automationChange,DomainValidationError,type P2Aggregate,type RuleAggregate,type ImportCandidate,type ScheduleAggregate,type ImportBatchAggregate,type ImportFingerprintAggregate,type ImportMappingAggregate,type TransactionAggregate} from '../../packages/domain/src/index.js';
import {coreCommandRequestSchema,coreCalculationRequestSchema,type UUID} from '../../packages/contracts/src/index.js';
const id=(n:number)=>`e0000000-0000-4000-8000-${String(n).padStart(12,'0')}` as UUID;
const spaceId=id(1),time='2026-10-08T12:00:00Z',context={operationId:id(900),occurredAt:time,generatedIds:Array.from({length:500},(_,n)=>id(1000+n))};
const meta=(n:number)=>({id:id(n),spaceId,revision:1,createdAt:time,updatedAt:time});
const account={...meta(2),aggregateType:'account' as const,name:'Giro',type:'checking' as const,onBudget:true,archived:false};
const group={...meta(3),aggregateType:'categoryGroup' as const,name:'Ausgaben',kind:'expense' as const,sortOrder:0,archived:false};
const category={...meta(4),aggregateType:'category' as const,name:'Lebensmittel',groupId:group.id,sortOrder:0,archived:false};
const payee={...meta(5),aggregateType:'payee' as const,name:'Prüfladen',aliases:['Café'],archived:false};
const base:P2Aggregate[]=[account,group,category,payee];
const rule:RuleAggregate={...meta(10),aggregateType:'rule',order:0,enabled:true,stopProcessing:false,conditions:[{field:'memo',operator:'contains',value:'Café'}],actions:[{field:'categoryId',value:category.id}]};
const schedule:ScheduleAggregate={...meta(20),aggregateType:'schedule',startDate:'2026-10-08',frequency:'monthly',interval:1,enabled:true,template:{accountId:account.id,amount:-1000,kind:'normal',clearance:'cleared',splits:[{id:id(21),categoryId:category.id,amount:-1000}]}};
const candidate:ImportCandidate={sourceRow:1,date:'2026-10-08',amount:-1000,payee:'  Cafe\u0301  ',memo:'Österreich 🏠',categoryId:category.id};
const batch:ImportBatchAggregate={...meta(30),aggregateType:'importBatch',fileHash:'a'.repeat(64),accountId:account.id,rows:[{sourceRow:1,candidate,decision:'import',issues:[]}],committedRows:[],state:'ready'};
function deps(){let position=0;return {ids:{next:()=>{ // Operations-ID ist von den erzeugten Fach-IDs im K01-Kontext getrennt.
 if(new Error().stack?.includes('createCommandStamp'))return context.operationId;
 const result=context.generatedIds[position++];if(result===undefined)throw new Error('Der synthetische ID-Vorrat ist erschöpft.');return result;
}},clock:{now:()=>time}};}
function rejected(error:unknown){if(!(error instanceof DomainValidationError))throw error;return {contractVersion:1,status:'rejected',error:{code:error.code,message:error.message}};}
export function automationCases(){const cases:{name:string;method:'calculate'|'execute';request:unknown;expected:unknown}[]=[];
 const calc=(name:string,request:unknown,action:()=>unknown)=>{const valid=coreCalculationRequestSchema.safeParse(request).success;let expected:unknown;try{if(!valid)throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');expected=action();}catch(e){expected=rejected(e);}cases.push({name,method:'calculate',request:valid?request:JSON.stringify(request),expected});};
 for(const scenario of ['NFC enthält','exakte Gleichheit','Betragsgrenze','Datumsgrenze','Stopp','deaktiviert','Tombstone','fehlendes Ziel','archiviertes Ziel','Betrag als Text']as const){
  let rules:RuleAggregate[]=[rule,{...rule,...meta(11),order:1,conditions:[{field:'memo',operator:'contains',value:'Österreich'}],actions:[{field:'payeeId',value:payee.id}]}];let row={...candidate,memo:'Cafe\u0301 Österreich'};let all=base;
  if(scenario==='exakte Gleichheit')rules=[{...rule,conditions:[{field:'payee',operator:'equals',value:'Café'}]}];
  if(scenario==='Betragsgrenze')rules=[{...rule,conditions:[{field:'amount',operator:'lte',value:-1000}]}];
  if(scenario==='Datumsgrenze')rules=[{...rule,conditions:[{field:'date',operator:'gte',value:'2026-10-08'}]}];
  if(scenario==='Stopp')rules=rules.map((r,n)=>n===0?{...r,stopProcessing:true}:r);
  if(scenario==='deaktiviert')rules=rules.map(r=>({...r,enabled:false}));
  if(scenario==='Tombstone')rules=rules.map(r=>({...r,deletedAt:time}));
  if(scenario==='fehlendes Ziel')rules=[{...rule,actions:[{field:'categoryId',value:id(99)}]}];
  if(scenario==='archiviertes Ziel')all=base.map(a=>a.id===category.id?{...category,archived:true}:a);
  if(scenario==='Betrag als Text')rules=[{...rule,conditions:[{field:'amount',operator:'equals',value:'1000'}]}];
  const request={contractVersion:1,domainSchemaVersion:1,spaceId,calculationType:'rule.apply',aggregates:[...all,...rules],candidate:row};calc(`Regeln ${scenario}`,request,()=>{const result=applyRules(row,rules,[...all,...rules],spaceId);return {contractVersion:1,status:'ruleApplied',candidate:result.candidate,appliedRuleIds:result.applied};});
 }
 for(const scenario of ['neu','gleiche Datei','gleiche ID','ID-Konflikt','andere Parserquelle','Tombstone','Fingerprinthinweis','doppelte Zeilennummer']as const){
  let rows:ImportCandidate[]=[candidate,{...candidate,sourceRow:2,payee:'Café'}];let all:ImportFingerprintAggregate[]=[];
  if(scenario==='gleiche ID'||scenario==='ID-Konflikt'||scenario==='andere Parserquelle')rows=rows.map(r=>({...r,externalId:'ID-1',parserSource:'camt053'}));
  if(scenario==='Fingerprinthinweis')rows=rows.map(r=>({...r,sourceFingerprint:'unveränderte-quellbasis'}));
  if(scenario==='doppelte Zeilennummer')rows=rows.map(r=>({...r,sourceRow:1}));
  if(scenario==='ID-Konflikt')rows=rows.map((r,n)=>n===1?{...r,amount:-1001}:r);
  if(scenario==='andere Parserquelle')rows=rows.map((r,n)=>n===1?{...r,parserSource:'ofx'}:r);
  if(scenario==='Tombstone')all=[{...meta(40),aggregateType:'importFingerprint',accountId:account.id,parserSource:'csv',fingerprint:importFingerprint(candidate),transactionId:id(99),importId:batch.id,sourceRow:1,deletedAt:time} as ImportFingerprintAggregate];
  const request={contractVersion:1,domainSchemaVersion:1,spaceId,calculationType:'import.classify',aggregates:all,accountId:account.id,candidates:rows};calc(`Dubletten ${scenario}`,request,()=>({contractVersion:1,status:'classified',rows:[...classifyImportCandidates(rows,account.id,all)].map(([sourceRow,classification])=>({sourceRow,classification}))}));
 }
 const command=(name:string,command:unknown,all:P2Aggregate[],action:()=>ReturnType<typeof automationChange>|null)=>{const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,command,expectedRevisions:[],context:{...context,generatedIds:[...context.generatedIds]}};const valid=coreCommandRequestSchema.safeParse(request).success;let expected:unknown;try{if(!valid)throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');const result=action();expected=result===null?{contractVersion:1,status:'unchanged'}:{contractVersion:1,status:'changed',changeSet:result};}catch(e){expected=rejected(e);}cases.push({name,method:'execute',request:valid?request:JSON.stringify(request),expected});};
 for(const [name,a,all]of [['Regel anlegen',rule,base],['Regel ändern',{...rule,revision:2},[...base,rule]],['Regel archiviertes Ziel',rule,base.map(a=>a.id===category.id?{...category,archived:true}:a)]]as [string,RuleAggregate,P2Aggregate[]][])command(name,{commandType:'rule.save',aggregates:[a]},all,()=>saveRule(a,all,deps()));
 command('Regel löschen',{commandType:'rule.delete',aggregateId:rule.id},[...base,rule],()=>deleteRule(rule,[...base,rule],deps()));
 command('Importvorlage',{commandType:'importMapping.save',aggregates:[{...meta(50),aggregateType:'importMapping',name:'CSV',mapping:{delimiter:';'}}]},base,()=>automationChange('importMapping.save',[{...meta(50),aggregateType:'importMapping',name:'CSV',mapping:{delimiter:';'}} as ImportMappingAggregate],base,deps()));
 command('Fremder Importbereich',{commandType:'importBatch.save',aggregates:[{...batch,spaceId:id(99)}]},base,()=>saveImportBatch({...batch,spaceId:id(99)},base,deps()));
 command('Fremder Dauerzahlungsbereich',{commandType:'schedule.save',aggregates:[{...schedule,spaceId:id(99)}]},base,()=>saveSchedule({...schedule,spaceId:id(99)},base,deps()));
 command('Importplan anlegen',{commandType:'importBatch.save',aggregates:[batch]},base,()=>saveImportBatch(batch,base,deps()));
 command('Importplan Entscheidungen ändern',{commandType:'importBatch.save',aggregates:[{...batch,revision:2,rows:[{...batch.rows[0]!,decision:'exclude'}]}]},[...base,batch],()=>saveImportBatch({...batch,revision:2,rows:[{...batch.rows[0]!,decision:'exclude'}]},[...base,batch],deps()));
 command('Dauerzahlung speichern',{commandType:'schedule.save',aggregates:[schedule]},base,()=>saveSchedule(schedule,base,deps()));
 for(const state of ['confirmed','skipped']as const)command(`Fälligkeit ${state}`,{commandType:state==='confirmed'?'schedule.confirm':'schedule.skip',scheduleId:schedule.id,dueDate:schedule.startDate},[...base,schedule],()=>resolveOccurrence(schedule,schedule.startDate,state,[...base,schedule],deps()));
 const imported:TransactionAggregate={...meta(60),aggregateType:'transaction',accountId:account.id,date:'2026-10-09',amount:-1000,kind:'normal',clearance:'cleared',splits:schedule.template.splits};
 command('Importierte Fälligkeit anderer Zahlungstag',{commandType:'schedule.confirm',scheduleId:schedule.id,dueDate:schedule.startDate,importedTransactionId:imported.id},[...base,schedule,imported],()=>resolveOccurrence(schedule,schedule.startDate,'confirmed',[...base,schedule,imported],deps(),imported));
 command('Falsche Fälligkeit',{commandType:'schedule.skip',scheduleId:schedule.id,dueDate:'2026-10-09'},[...base,schedule],()=>resolveOccurrence(schedule,'2026-10-09','skipped',[...base,schedule],deps()));
 for(const [name,b]of [['Importgruppe mit Aliaszuordnung',batch],['Importgruppe neuer Empfänger',{...batch,rows:[{...batch.rows[0]!,candidate:{...candidate,payee:'Neuer Prüfladen'}}]}],['Importgruppe Ausschluss',{...batch,rows:[{...batch.rows[0]!,candidate:null,decision:'exclude'}]}]]as [string,ImportBatchAggregate][])command(name,{commandType:'import.commit',importId:b.id},[...base,b],()=>commitImportGroup(b,[...base,b],deps()));

 const resolved=resolveOccurrence(schedule,schedule.startDate,'confirmed',[...base,schedule],deps())!;
 const stateMap=new Map([...base,schedule].map(a=>[a.id,a as P2Aggregate]));for(const a of resolved.aggregates)stateMap.set(a.id,a);const resolvedState=[...stateMap.values()];const currentSchedule=resolvedState.find(a=>a.id===schedule.id) as ScheduleAggregate;
 command('Fälligkeit idempotent bestätigen',{commandType:'schedule.confirm',scheduleId:schedule.id,dueDate:schedule.startDate},resolvedState,()=>resolveOccurrence(currentSchedule,schedule.startDate,'confirmed',resolvedState,deps()));
 command('Fälligkeit widersprüchlich erledigen',{commandType:'schedule.skip',scheduleId:schedule.id,dueDate:schedule.startDate},resolvedState,()=>resolveOccurrence(currentSchedule,schedule.startDate,'skipped',resolvedState,deps()));
 const oldBatch:ImportBatchAggregate={...batch,id:id(70),state:'completed',committedRows:[1]};
 const altered:ImportBatchAggregate={...oldBatch,revision:2,rows:[{...oldBatch.rows[0]!,candidate:{...candidate,amount:-1001}}]};
 command('Übernommene Importzeile unveränderlich',{commandType:'importBatch.save',aggregates:[altered]},[...base,oldBatch],()=>saveImportBatch(altered,[...base,oldBatch],deps()));
 command('Keine ausstehenden Importzeilen',{commandType:'import.commit',importId:oldBatch.id},[...base,oldBatch],()=>commitImportGroup(oldBatch,[...base,oldBatch],deps()));
 const ambiguous={...payee,id:id(71),name:'Café',aliases:[]};
 command('Mehrdeutige Empfängerzuordnung blockiert',{commandType:'import.commit',importId:batch.id},[...base,ambiguous,batch],()=>commitImportGroup(batch,[...base,ambiguous,batch],deps()));
 const large:ImportBatchAggregate={...batch,rows:Array.from({length:101},(_,n)=>({sourceRow:n+1,candidate:{...candidate,sourceRow:n+1,externalId:`synthetisch-${n+1}`},decision:'import' as const,issues:[]}))};
 command('101 Zeilen begrenzt auf atomare Gruppe100',{commandType:'import.commit',importId:large.id},[...base,large],()=>commitImportGroup(large,[...base,large],deps()));

 const originalIds=context.generatedIds;
 const chainBatch:ImportBatchAggregate={...batch,rows:Array.from({length:205},(_,n)=>({sourceRow:n+1,candidate:{...candidate,sourceRow:n+1,externalId:`mehrgruppe-${n+1}`},decision:'import' as const,issues:[]}))};
 let chainState:P2Aggregate[]=[...base,chainBatch];
 for(let index=0;index<3;index++){
  context.generatedIds=Array.from({length:500},(_,n)=>id(3000+index*1000+n));
  const current=chainState.find(a=>a.id===chainBatch.id) as ImportBatchAggregate;
  const inputState=chainState;
  command(`205 Importzeilen Folgegruppe ${index+1}`,{commandType:'import.commit',importId:chainBatch.id},inputState,()=>commitImportGroup(current,inputState,deps()));
  const change=commitImportGroup(current,inputState,deps())!;const map=new Map(inputState.map(a=>[a.id,a]));for(const a of change.aggregates)map.set(a.id,a);chainState=[...map.values()];
 }
 command('205 Zeilen vollständig ohne Wiederholungswrite',{commandType:'import.commit',importId:chainBatch.id},chainState,()=>commitImportGroup(chainState.find(a=>a.id===chainBatch.id) as ImportBatchAggregate,chainState,deps()));
 context.generatedIds=originalIds;
 return cases;
}
