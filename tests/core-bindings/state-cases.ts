// SPDX-License-Identifier: AGPL-3.0-or-later
import { DomainValidationError, validateFinancialState, rebuildFinancialProjections, type P2Aggregate, type TransactionAggregate, type CategoryAggregate, type CategoryGroupAggregate } from '../../packages/domain/src/index.js';
import { coreValidationRequestSchema, coreStateRequestSchema } from '../../packages/contracts/src/index.js';
import type { UUID } from '../../packages/contracts/src/index.js';
import { validateFinancialReferences } from '../../packages/domain/src/financial-references.js';
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const spaceId = id(1), now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
const account = { ...meta(2), aggregateType: 'account', name: 'Giro', type: 'checking', onBudget: true, archived: false };
const group = { ...meta(3), aggregateType: 'categoryGroup', name: 'Ausgaben', kind: 'expense', sortOrder: 0, archived: false };
const incomeGroup = { ...group, ...meta(4), kind: 'income' };
const category = { ...meta(5), aggregateType: 'category', name: 'Lebensmittel', groupId: group.id, sortOrder: 0, archived: false };
const incomeCategory = { ...category, ...meta(6), groupId: incomeGroup.id };
const opening = { ...meta(7), aggregateType: 'transaction', accountId: account.id, date: '2026-10-08', amount: 100_000, kind: 'opening', clearance: 'cleared', splits: [] };
const expense = { ...opening, ...meta(8), kind: 'normal', amount: -10_000, splits: [{ id: id(9), categoryId: category.id, amount: -10_000 }] };
const income = { ...expense, ...meta(10), amount: 20_000, splits: [{ id: id(11), categoryId: incomeCategory.id, amount: 20_000 }] };
const base = [account,group,incomeGroup,category,incomeCategory,opening,expense,income];
const second = { ...account, ...meta(20), name: 'Bar', archived: true };
const transfer = { ...meta(21), aggregateType: 'transfer', date: opening.date, sourceAccountId: account.id, targetAccountId: second.id, sourceTransactionId: id(22), targetTransactionId: id(23), amount: 20_000 };
const source = { ...opening, ...meta(22), kind: 'transfer', transferId: transfer.id, amount: -20_000 };
const destination = { ...source, ...meta(23), accountId: second.id, amount: 20_000 };
const schedule = { ...meta(30), aggregateType: 'schedule', startDate: '2026-10-08', frequency: 'monthly', interval: 1, enabled: true, template: { accountId: account.id, amount: expense.amount, kind: 'normal', clearance: 'cleared', splits: expense.splits } };
const occurrence = { ...meta(31), aggregateType: 'scheduleOccurrence', scheduleId: schedule.id, dueDate: '2026-10-08', state: 'confirmed', transactionId: id(32) };
const payment = { ...expense, ...meta(32), date: '2026-10-09', scheduleOccurrenceId: occurrence.id };
const batch = { ...meta(41), aggregateType: 'importBatch', fileHash: 'a'.repeat(64), accountId: account.id, rows: [{ sourceRow: 1, candidate: { sourceRow: 1, date: expense.date, amount: expense.amount, categoryId: category.id }, decision: 'import', issues: [] }], committedRows: [1], state: 'completed' };
const fingerprint = { ...meta(42), aggregateType: 'importFingerprint', accountId: account.id, parserSource: 'csv', fingerprint: 'synthetisch', transactionId: id(40), importId: batch.id, sourceRow: 1 };
const payee = { ...meta(50), aggregateType: 'payee', name: 'Österreich', aliases: ['Prüfladen'], archived: false };
const rule = { ...meta(51), aggregateType: 'rule', order: 0, conditions: [{ field: 'date', operator: 'equals', value: '2028-02-29' }], actions: [{ field: 'categoryId', value: category.id }], stopProcessing: false, enabled: true };
const reconciliation = { ...meta(60), aggregateType: 'reconciliation', accountId: account.id, statementDate: '2026-10-08', statementBalance: 90_000, transactionIds: [opening.id,expense.id] };
const scenarios: [string, unknown[]][] = [
  ['leerer Bestand',[]], ['F01',base], ['F03 historisches Konto',[...base,second,transfer,source,destination]],
  ['historische Tombstones',base.map(a => a.id===category.id || a.id===group.id ? { ...a, deletedAt: now } : a)],
  ['importierte Dauerzahlung anderer Tag',[...base,schedule,occurrence,payment]],
  ['Fingerprint nach Kontowechsel',[...base,second,{ ...expense,...meta(40), accountId: second.id },batch,fingerprint]],
  ['Empfänger und Regel',[...base,payee,rule]], ['Importvorlage',[...base,{...meta(52),aggregateType:'importMapping',name:'Vorlage',mapping:{ nested:[true,null,'Österreich',1] }}]],
  ['Abgleich',[...base.map(a => [opening.id,expense.id].includes(a.id) ? {...a,clearance:'reconciled'} : a),reconciliation]],
  ['fehlende Kategorie',base.filter(a => a.id!==category.id)], ['doppelte ID',[...base,account]],
  ['fremder Bereich',base.map(a => a.id===account.id ? {...a,spaceId:id(99)} : a)],
  ['reservierte ID',base.map(a => a.id===account.id ? {...a,id:spaceId} : a)],
  ['Finanzrevision',[...base,{ ...meta(1),aggregateType:'financialRevision' }]],
  ['Revision null',base.map(a => a.id===account.id ? {...a,revision:0} : a)],
  ['unsichere Revision',base.map(a => a.id===account.id ? {...a,revision:Number.MAX_SAFE_INTEGER+1} : a)],
  ['Zeit vor Anlage',base.map(a => a.id===account.id ? {...a,updatedAt:'2026-10-07T10:00:00Z'} : a)],
  ['falscher UTC Tag',base.map(a => a.id===account.id ? {...a,createdAt:'2026-02-30T10:00:00Z'} : a)],
  ['UTC ohne Sekunden',base.map(a => ({...a,createdAt:'2026-10-08T10:00Z',updatedAt:'2026-10-08T10:00Z'}))],
  ['Offset statt UTC',base.map(a => a.id===account.id ? {...a,createdAt:'2026-10-08T10:00:00+01:00'} : a)],
  ['Unicode-Zeit',base.map(a => a.id===account.id ? {...a,createdAt:'ÖÖÖÖÖT10:00:00Z'} : a)],
  ['unbekanntes Feld',base.map(a => a.id===account.id ? {...a,unexpected:true} : a)],
  ['optionales null',base.map(a => a.id===expense.id ? {...a,note:null} : a)],
  ['Speicherhandle im Kern',base.map(a => a.id===account.id ? {...a,handle:id(90)} : a)],
  ['Kreditkonto im Budget',base.map(a => a.id===account.id ? {...a,type:'credit'} : a)],
  ['F02 falsche Splitsumme',base.map(a => a.id===expense.id ? {...expense,splits:[{...expense.splits[0]!,amount:-9999}]} : a)],
  ['Split doppelte ID',base.map(a => a.id===expense.id ? {...expense,splits:[...expense.splits,...expense.splits]} : a)],
  ['fehlende Transferseite',[...base,second,transfer,source]],
  ['falscher Transferbetrag',[...base,second,transfer,source,{...destination,amount:19999}]],
  ['Transfer unvollständige Tombstones',[...base,second,{...transfer,deletedAt:now},source,destination]],
  ['Transfer positiv',[...base,second,{...transfer,amount:-1},source,destination]],
  ['Abgleich ohne Gruppe',base.map(a => a.id===expense.id ? {...a,clearance:'reconciled'} : a)],
  ['Abgleich doppelte Auswahl',[...base,reconciliation, {...reconciliation,...meta(61)}]],
  ['doppelter Alias',[...base,{...payee,aliases:['Prüfladen','  PRÜFLADEN ']}]],
  ['NFC gleicher Name',[...base,{...payee,name:'Café',aliases:['Cafe\u0301']}]],
  ['gültige Unicode-Aliasse',[...base,{...payee,name:'ΣΩΣ',aliases:['ΣΟΣ','İstanbul','Straße']}]],
  ['Systemkategorie archiviert',base.map(a => a.id===category.id ? {...a,system:'uncategorized',archived:true} : a)],
  ['Regel Textoperator',[...base,{...rule,conditions:[{field:'memo',operator:'gte',value:'a'}]}]],
  ['Regel Betrags-contains',[...base,{...rule,conditions:[{field:'amount',operator:'contains',value:100}]}]],
  ['Regel Betrags-Text',[...base,{...rule,conditions:[{field:'amount',operator:'equals',value:'100'}]}]],
  ['Regel fehlendes Ziel',[...base,{...rule,actions:[{field:'categoryId',value:id(99)}]}]],
  ['Import Quellzeile',[...base,{...batch,rows:[{...batch.rows[0]!,sourceRow:2}],committedRows:[]}]],
  ['Import ungültige Entscheidung',[...base,{...batch,rows:[{...batch.rows[0]!,issues:['Fehler']}]}]],
  ['Import falscher Fortschritt',[...base,{...batch,committedRows:[2]}]],
  ['Dauerzahlung Enddatum',[...base,{...schedule,endDate:'2026-10-07'}]],
  ['Dauerzahlung geskippt',[...base,schedule,{...occurrence,state:'skipped',transactionId:undefined}]],
  ['Dauerzahlung übersprungen mit Buchung',[...base,schedule,{...occurrence,state:'skipped'}]],
  ['Gesamtsaldo Überlauf',[{...account}, {...second}, {...opening,amount:Number.MAX_SAFE_INTEGER}, {...opening,...meta(70),accountId:second.id,amount:1}]],
  ['Monat Zwischenüberlauf',[{...account}, {...opening,amount:Number.MAX_SAFE_INTEGER}, {...opening,...meta(70),amount:1}, {...opening,...meta(71),amount:-1}]],
];
export function stateCases() {
  const cases: {name:string; method:'validate'|'project'; request:unknown; expected:unknown}[] = scenarios.flatMap(([name, raw]) => {
    // Normaler JSON-Transport lässt undefined abwesend; ein Speicherhandle gehört nicht in den Engineport.
    const all = JSON.parse(JSON.stringify(raw)) as P2Aggregate[];
    return (['validate','project'] as const).map(method => {
      const request={contractVersion:1,domainSchemaVersion:1,spaceId,aggregates:all,...(method==='validate'?{mode:'historical'}:{})};
      let expected: unknown;
      try {
        if (!(method==='validate'?coreValidationRequestSchema:coreStateRequestSchema).safeParse(request).success) throw new DomainValidationError('INVALID_COMMAND','Der Fachbefehl ist ungültig.');
        if (all.some(a => Object.hasOwn(a,'handle'))) throw new DomainValidationError('INVALID_AGGREGATE','Der Finanzbestand ist unvollständig oder widerspricht dem Fachvertrag.');
        validateFinancialState(all,spaceId);
        expected = method==='validate' ? {contractVersion:1,status:'valid'} : {contractVersion:1,status:'projected',projections:rebuildFinancialProjections({transactions:all.filter((a):a is TransactionAggregate=>a.aggregateType==='transaction'),categories:all.filter((a):a is CategoryAggregate=>a.aggregateType==='category'),categoryGroups:all.filter((a):a is CategoryGroupAggregate=>a.aggregateType==='categoryGroup')})};
      } catch(error) { if (!(error instanceof DomainValidationError)) throw error; expected={contractVersion:1,status:'rejected',error:{code:error.code,message:error.message}}; }
      return { name:`Bestandsprüfung ${method}: ${name}`,method,request,expected };
    });
  });
  const historical=base.map(a=>a.id===category.id || a.id===group.id ? {...a,deletedAt:now} : a);
  for (const [name,after] of [
    ['historische Referenz erhalten', historical.map(a=>a.id===expense.id?{...expense,revision:2}:a)],
    ['neuer Split an Tombstone',historical.map(a=>a.id===expense.id?{...expense,revision:2,splits:[{...expense.splits[0]!,id:id(99)}]}:a)],
    ['neue Buchung an Tombstone',[...historical,{...expense,...meta(99)}]],
    ['archivierte Referenz',base.map(a=>a.id===category.id?{...a,archived:true}:a)]
  ] as [string,unknown[]][]) {
    const before=JSON.parse(JSON.stringify(name==='archivierte Referenz'?base:historical)) as P2Aggregate[];
    const next=JSON.parse(JSON.stringify(after)) as P2Aggregate[];
    let expected: unknown;
    try { validateFinancialState(before,spaceId); validateFinancialState(next,spaceId); validateFinancialReferences(next,before); expected={contractVersion:1,status:'valid'}; }
    catch(error) { if (!(error instanceof DomainValidationError)) throw error; expected={contractVersion:1,status:'rejected',error:{code:error.code,message:error.message}}; }
    cases.push({name:`Mutation ${name}`,method:'validate',request:{contractVersion:1,domainSchemaVersion:1,spaceId,mode:'mutation',before,after:next},expected});
  }

  const validWire = JSON.stringify({contractVersion:1,domainSchemaVersion:1,spaceId,mode:'historical',aggregates:base});
  cases.push({name:'JSON-Ganzzahlen in Dezimalnotation',method:'validate',request:validWire.replace(/("(?:contractVersion|domainSchemaVersion|amount)":)(-?\d+)/g, '$1$2.0'),expected:{contractVersion:1,status:'valid'}});
  let wireCase=0;
  for (const request of ['null','[1,2]','{','{"contractVersion":1,"domainSchemaVersion":1,"mode":"historical"}', validWire.replace('"revision":1','"revision":1.5')]) cases.push({name:`Ungültiger JSON-Eingang ${++wireCase}: ${request.slice(0,25)}`,method:'validate',request,expected:{contractVersion:1,status:'rejected',error:{code:'INVALID_COMMAND',message:'Der Fachbefehl ist ungültig.'}}});
  return cases;

}
