// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IsoDate, Money, UUID } from '@wimm/contracts';
import { uuidSchema } from '@wimm/contracts';
import { createAggregateMetadata, createChangeSet, reviseAggregate, type DomainDependencies, type DomainChangeSet, type P2Aggregate, type P2CommandType } from './commands.js';
import { parseFinanceDate } from './calendar.js';
import { assertMoney, sumMoney } from './money.js';
import { DomainValidationError } from './errors.js';
import { saveTransaction, type TransactionAggregate, type TransactionFields } from './transactions.js';
import { savePayee, type PayeeAggregate } from './master-data.js';

export type RuleCondition = { field: 'date' | 'amount' | 'payee' | 'memo'; operator: 'equals' | 'contains' | 'gte' | 'lte'; value: string | number };
export type RuleAction = { field: 'categoryId' | 'payeeId'; value: UUID } | { field: 'clearance'; value: 'uncleared' | 'cleared' };
export type RuleAggregate = P2Aggregate<'rule', { order: number; conditions: readonly RuleCondition[]; actions: readonly RuleAction[]; stopProcessing: boolean; enabled: boolean }>;
export type ScheduleAggregate = P2Aggregate<'schedule', { startDate: IsoDate; frequency: 'weekly' | 'monthly' | 'yearly'; interval: number; endDate?: IsoDate; enabled: boolean; template: Omit<TransactionFields, 'date' | 'scheduleOccurrenceId' | 'importReference'> }>;
export type OccurrenceAggregate = P2Aggregate<'scheduleOccurrence', { scheduleId: UUID; dueDate: IsoDate; state: 'confirmed' | 'skipped'; transactionId?: UUID }>;
export interface ImportCandidate { sourceRow: number; parserSource?: 'csv' | 'camt053' | 'ofx' | 'qfx'; date: IsoDate; amount: Money; payee?: string; memo?: string; externalId?: string; sourceFingerprint?: string; categoryId?: UUID; payeeId?: UUID; clearance?: 'uncleared' | 'cleared' }
export type ImportDecision = 'import' | 'exclude' | 'separate';
export type ImportBatchAggregate = P2Aggregate<'importBatch', { fileHash: string; accountId: UUID; rows: readonly { candidate: ImportCandidate | null; sourceRow: number; decision: ImportDecision; issues: readonly string[] }[]; committedRows: readonly number[]; state: 'ready' | 'partial' | 'completed' }>;
export type ImportFingerprintAggregate = P2Aggregate<'importFingerprint', { accountId: UUID; parserSource: string; externalId?: string; fingerprint: string; transactionId: UUID; importId: UUID; sourceRow: number }>;
export type ImportMappingAggregate = P2Aggregate<'importMapping', { name: string; mapping: unknown }>;
function fail(message: string): never { throw new DomainValidationError('INVALID_COMMAND', message); }
function active(all: readonly P2Aggregate[], type: P2Aggregate['aggregateType']) { return all.filter(a => a.aggregateType === type && a.deletedAt === undefined); }
function references(all: readonly P2Aggregate[], spaceId: UUID, id: UUID, type: P2Aggregate['aggregateType']) {
  const a = all.find(entry => entry.id === id);
  if (!a || a.spaceId !== spaceId || a.aggregateType !== type || a.deletedAt !== undefined || ('archived' in a && a.archived)) fail('Die Referenz ist nicht im aktiven Bereich verfügbar.');
  return a;
}
export function automationChange(commandType: P2CommandType, aggregates: readonly P2Aggregate[], all: readonly P2Aggregate[], deps: DomainDependencies, read: readonly UUID[] = []): DomainChangeSet {
  if (!aggregates.length) fail('Die Änderung ist leer.');
  const map = new Map(all.map(a => [a.id, a]));
  const ids = [...new Set([...aggregates.map(a => a.id), ...read])];
  return createChangeSet({ commandType, spaceId: aggregates[0]!.spaceId, expectedRevisions: ids.map(id => ({ id, expectedRevision: map.get(id)?.revision ?? 0 })), mutations: aggregates.map(aggregate => ({ aggregate })) }, { get: id => map.get(id) }, deps);
}
export function validateRule(rule: RuleAggregate, all: readonly P2Aggregate[]): void {
  if (!Number.isSafeInteger(rule.order) || rule.order < 0 || typeof rule.enabled !== 'boolean' || typeof rule.stopProcessing !== 'boolean' || !Array.isArray(rule.conditions) || !rule.conditions.length || !Array.isArray(rule.actions) || !rule.actions.length) fail('Die Regel ist unvollständig.');
  for (const c of rule.conditions as readonly RuleCondition[]) {
    if (!['date', 'amount', 'payee', 'memo'].includes(c.field) || !['equals', 'contains', 'gte', 'lte'].includes(c.operator)) fail('Die Regelbedingung ist nicht erlaubt.');
    if (c.field === 'amount') { assertMoney(c.value as Money); if (c.operator === 'contains') fail('Beträge unterstützen keine Textsuche.'); }
    else { if (typeof c.value !== 'string' || !c.value.length) fail('Die Textbedingung ist leer.'); if (c.field === 'date') { parseFinanceDate(c.value); if (c.operator === 'contains') fail('Datum unterstützt keine Textsuche.'); } else if (!['equals', 'contains'].includes(c.operator)) fail('Text unterstützt nur Gleichheit und Enthalten.'); }
  }
  for (const a of rule.actions as readonly RuleAction[]) {
    if (a.field === 'categoryId') references(all, rule.spaceId, a.value, 'category');
    else if (a.field === 'payeeId') references(all, rule.spaceId, a.value, 'payee');
    else if (a.field !== 'clearance' || !['uncleared', 'cleared'].includes(a.value)) fail('Die Regelaktion ist nicht erlaubt.');
  }
}
export function saveRule(rule: RuleAggregate, all: readonly P2Aggregate[], deps: DomainDependencies) { validateRule(rule, all); return automationChange('rule.save', [rule], all, deps, rule.actions.flatMap(a => a.field === 'clearance' ? [] : [a.value])); }
export function deleteRule(rule: RuleAggregate, all: readonly P2Aggregate[], deps: DomainDependencies) { return automationChange('rule.delete', [reviseAggregate({ ...rule, deletedAt: deps.clock.now() }, deps)], all, deps); }
export function reorderRules(ids: readonly UUID[], rules: readonly RuleAggregate[], all: readonly P2Aggregate[], deps: DomainDependencies) {
  if (ids.length !== rules.length || new Set(ids).size !== ids.length || rules.some(r => !ids.includes(r.id))) fail('Die neue Reihenfolge muss alle Regeln genau einmal enthalten.');
  return automationChange('rule.reorder', ids.map((id, order) => reviseAggregate({ ...rules.find(r => r.id === id)!, order }, deps)), all, deps);
}
export function applyRules(candidate: ImportCandidate, rules: readonly RuleAggregate[], all: readonly P2Aggregate[], spaceId: UUID): { candidate: ImportCandidate; applied: UUID[] } {
  let result = { ...candidate, sourceFingerprint: importFingerprint(candidate) }; const applied: UUID[] = [];
  for (const rule of [...rules].filter(r => r.enabled && !r.deletedAt && r.spaceId === spaceId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    validateRule(rule, all);
    const match = rule.conditions.every(c => { const value = result[c.field] ?? ''; return c.operator === 'equals' ? value === c.value : c.operator === 'contains' ? String(value).normalize('NFC').toLocaleLowerCase('de').includes(String(c.value).normalize('NFC').toLocaleLowerCase('de')) : c.operator === 'gte' ? value >= c.value : value <= c.value; });
    if (!match) continue;
    for (const action of rule.actions) { result = { ...result, [action.field]: action.value }; if (action.field === 'payeeId') result = { ...result, payee: (references(all, spaceId, action.value, 'payee') as P2Aggregate<'payee', { name: string }>).name }; }
    applied.push(rule.id); if (rule.stopProcessing) break;
  }
  return { candidate: result, applied };
}
export function dueDates(schedule: ScheduleAggregate, through: IsoDate): IsoDate[] {
  parseFinanceDate(schedule.startDate); parseFinanceDate(through);
  if (!['weekly', 'monthly', 'yearly'].includes(schedule.frequency) || !Number.isSafeInteger(schedule.interval) || schedule.interval < 1) fail('Der Rhythmus benötigt ein positives ganzzahliges Intervall.');
  if (schedule.endDate) { parseFinanceDate(schedule.endDate); if (schedule.endDate < schedule.startDate) fail('Das Enddatum liegt vor dem Startdatum.'); }
  if (!schedule.enabled) return [];
  const [year, month, day] = schedule.startDate.split('-').map(Number) as [number, number, number];
  const dates: IsoDate[] = [];
  for (let index = 0; index <= 100_000; index++) {
    const delta = index * schedule.interval;
    if (!Number.isSafeInteger(delta)) fail('Das Intervall überschreitet die Ganzzahlgrenze.');
    let date: Date;
    if (schedule.frequency === 'weekly') { date = new Date(`${schedule.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + delta * 7); }
    else { const targetMonth = month - 1 + (schedule.frequency === 'monthly' ? delta : delta * 12); const y = year + Math.floor(targetMonth / 12); const m = targetMonth % 12; if (y > 9999) break; const end = new Date(0); end.setUTCFullYear(y, m + 1, 0); date = new Date(0); date.setUTCFullYear(y, m, Math.min(day, end.getUTCDate())); }
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) break;
    const iso = parseFinanceDate(date.toISOString().slice(0, 10));
    if (iso > through || (schedule.endDate && iso > schedule.endDate)) break;
    if (index === 100_000) fail('Zu viele Fälligkeiten.');
    dates.push(iso);
  }
  return dates;
}
export function saveSchedule(schedule: ScheduleAggregate, all: readonly P2Aggregate[], deps: DomainDependencies) {
  if (typeof schedule.enabled !== 'boolean') fail('Der Aktivierungsstatus ist ungültig.');
  dueDates({ ...schedule, enabled: true }, schedule.startDate);
  const tx: TransactionAggregate = { ...createAggregateMetadata(schedule.spaceId, deps), aggregateType: 'transaction', ...schedule.template, date: schedule.startDate };
  if (tx.kind !== 'normal' || tx.clearance === 'reconciled') fail('Die Vorlage muss eine normale offene Buchung sein.');
  const checked = checkedTransaction(tx, all, deps);
  return automationChange('schedule.save', [schedule], all, deps, checked.expectedRevisions.filter(e => e.id !== tx.id).map(e => e.id));
}
function checkedTransaction(tx: TransactionAggregate, all: readonly P2Aggregate[], deps: DomainDependencies) {
  const refs = [tx.accountId, ...tx.splits.map(s => s.categoryId), ...(tx.payeeId ? [tx.payeeId] : [])];
  references(all, tx.spaceId, tx.accountId, 'account'); tx.splits.forEach(s => references(all, tx.spaceId, s.categoryId, 'category')); if (tx.payeeId) references(all, tx.spaceId, tx.payeeId, 'payee');
  const map = new Map(all.map(a => [a.id, a]));
  return saveTransaction({ commandType: 'transaction.save', spaceId: tx.spaceId, expectedRevisions: [...new Set([tx.id, ...refs])].map(id => ({ id, expectedRevision: map.get(id)?.revision ?? 0 })), mutations: [{ aggregate: tx }] }, { get: id => map.get(id) }, deps);
}
export function resolveOccurrence(schedule: ScheduleAggregate, date: IsoDate, state: 'confirmed' | 'skipped', all: readonly P2Aggregate[], deps: DomainDependencies, imported?: TransactionAggregate): DomainChangeSet | null {
  const currentSchedule = references(all, schedule.spaceId, schedule.id, 'schedule');
  if (!['confirmed', 'skipped'].includes(state)) fail('Der Fälligkeitsstatus ist ungültig.');
  if (!dueDates(schedule, date).includes(date)) fail('Das Datum ist keine aktive Fälligkeit.');
  const existing = (active(all, 'scheduleOccurrence') as OccurrenceAggregate[]).find(o => o.scheduleId === schedule.id && o.dueDate === date && o.spaceId === schedule.spaceId);
  if (existing) { if (existing.state !== state || (imported && existing.transactionId !== imported.id)) fail('Die Fälligkeit ist bereits anders erledigt.'); return null; }
  if (currentSchedule.revision !== schedule.revision) fail('Die Dauerzahlung ist veraltet.');
  const occurrence: OccurrenceAggregate = { ...createAggregateMetadata(schedule.spaceId, deps), aggregateType: 'scheduleOccurrence', scheduleId: schedule.id, dueDate: date, state };
  const aggregates: P2Aggregate[] = [reviseAggregate(schedule, deps)]; let refs: UUID[] = [schedule.id];
  if (state === 'confirmed') {
    if (imported && (imported.spaceId !== schedule.spaceId || imported.accountId !== schedule.template.accountId)) fail('Die importierte Zahlung liegt in einem anderen Bereich.');
    if (imported?.scheduleOccurrenceId) fail('Die Zahlung ist bereits einer Fälligkeit zugeordnet.');
    const tx: TransactionAggregate = imported ? reviseAggregate({ ...imported, scheduleOccurrenceId: occurrence.id }, deps) : { ...createAggregateMetadata(schedule.spaceId, deps), aggregateType: 'transaction', ...schedule.template, date, scheduleOccurrenceId: occurrence.id, splits: schedule.template.splits.map(split => ({ ...split, id: deps.ids.next() })) };
    if (!imported) {
      sumMoney([...all.filter((a): a is TransactionAggregate => a.aggregateType === 'transaction' && !a.deletedAt && a.spaceId === schedule.spaceId && (a as TransactionAggregate).accountId === tx.accountId).map(a => a.amount), tx.amount]);
      aggregates.push(reviseAggregate(references(all, schedule.spaceId, tx.accountId, 'account'), deps));
    }
    const checked = checkedTransaction(tx, all, deps); refs = [...refs, ...checked.expectedRevisions.filter(e => e.id !== tx.id).map(e => e.id)];
    aggregates.push(checked.aggregates[0]!, { ...occurrence, transactionId: tx.id } as OccurrenceAggregate);
  } else aggregates.push(occurrence);
  return automationChange(state === 'confirmed' ? 'schedule.confirm' : 'schedule.skip', aggregates, all, deps, refs);
}
export function importFingerprint(row: ImportCandidate): string { return row.sourceFingerprint ?? JSON.stringify([row.date, row.amount, (row.payee ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de'), (row.memo ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')]); }
export function classifyImportCandidates(rows: readonly ImportCandidate[], accountId: UUID, fingerprints: readonly ImportFingerprintAggregate[]): Map<number, 'new' | 'duplicate' | 'conflict'> {
  const ids = new Map<string, Set<string>>(); const contents = new Set<string>();
  const key = (source: string, id: string) => JSON.stringify([source, id]);
  for (const f of fingerprints) if (f.accountId === accountId && !f.deletedAt) { contents.add(f.fingerprint); if (f.externalId) { const k = key(f.parserSource, f.externalId); const values = ids.get(k) ?? new Set<string>(); values.add(f.fingerprint); ids.set(k, values); } }
  const result = new Map<number, 'new' | 'duplicate' | 'conflict'>();
  for (const row of rows) {
    const fingerprint = importFingerprint(row); const k = row.externalId ? key(row.parserSource ?? 'csv', row.externalId) : undefined; const same = k ? ids.get(k) : undefined;
    result.set(row.sourceRow, same && [...same].some(f => f !== fingerprint) ? 'conflict' : (k ? !!same?.size : contents.has(fingerprint)) ? 'duplicate' : 'new');
    contents.add(fingerprint); if (k) { const values = same ?? new Set<string>(); values.add(fingerprint); ids.set(k, values); }
  }
  return result;
}
export function duplicateStatus(row: ImportCandidate, accountId: UUID, fingerprints: readonly ImportFingerprintAggregate[]): 'new' | 'duplicate' | 'conflict' {
  const fingerprint = importFingerprint(row);
  const sameId = row.externalId ? fingerprints.filter(f => f.accountId === accountId && f.parserSource === (row.parserSource ?? 'csv') && f.externalId === row.externalId) : [];
  if (sameId.some(f => f.fingerprint !== fingerprint)) return 'conflict';
  return (row.externalId ? sameId.length > 0 : fingerprints.some(f => f.accountId === accountId && f.fingerprint === fingerprint)) ? 'duplicate' : 'new';
}
function validateImportBatch(batch: ImportBatchAggregate, all: readonly P2Aggregate[]) {
  references(all, batch.spaceId, batch.accountId, 'account');
  if (!/^[a-f0-9]{64}$/.test(batch.fileHash) || batch.rows.length > 100_000 || !batch.rows.length || new Set(batch.rows.map(r => r.sourceRow)).size !== batch.rows.length) fail('Die Importbeschreibung ist ungültig.');
  for (const row of batch.rows) {
    if (!Number.isSafeInteger(row.sourceRow) || row.sourceRow < 1 || !['import', 'exclude', 'separate'].includes(row.decision)) fail('Die Zeilenentscheidung ist ungültig.');
    if (row.decision !== 'exclude' && (!row.candidate || row.issues.length)) fail('Ungültige Zeilen müssen korrigiert oder ausdrücklich ausgeschlossen werden.');
    if (row.candidate && row.candidate.sourceRow !== row.sourceRow) fail('Die Quellzeile stimmt nicht überein.');
  }
  if (!['ready', 'partial', 'completed'].includes(batch.state) || new Set(batch.committedRows).size !== batch.committedRows.length || batch.committedRows.some(n => !batch.rows.some(r => r.sourceRow === n))) fail('Der Importfortschritt ist ungültig.');
}
export function saveImportBatch(batch: ImportBatchAggregate, all: readonly P2Aggregate[], deps: DomainDependencies) {
  validateImportBatch(batch, all);
  const previous = all.find(a => a.id === batch.id) as ImportBatchAggregate | undefined;
  if (!previous && (batch.committedRows.length || batch.state !== 'ready')) fail('Ein neuer Import muss ohne übernommene Zeilen beginnen.');
  if (previous && (previous.rows.length !== batch.rows.length || previous.rows.some(row => !batch.rows.some(r => r.sourceRow === row.sourceRow)) || previous.state !== batch.state)) fail('Quellzeilen und Fortschrittsstatus dürfen nicht still geändert werden.');
  if (previous && (previous.fileHash !== batch.fileHash || previous.accountId !== batch.accountId || JSON.stringify(previous.committedRows) !== JSON.stringify(batch.committedRows) || previous.committedRows.some(n => JSON.stringify(previous.rows.find(r => r.sourceRow === n)) !== JSON.stringify(batch.rows.find(r => r.sourceRow === n))))) fail('Bereits übernommene Importzeilen sind unveränderlich.');
  return automationChange('importBatch.save', [batch], all, deps, [batch.accountId]);
}
export function commitImportGroup(batch: ImportBatchAggregate, all: readonly P2Aggregate[], deps: DomainDependencies): DomainChangeSet | null {
  validateImportBatch(batch, all);
  const current = all.find(a => a.id === batch.id);
  if (!current || current.revision !== batch.revision || JSON.stringify((current as ImportBatchAggregate).rows) !== JSON.stringify(batch.rows) || JSON.stringify((current as ImportBatchAggregate).committedRows) !== JSON.stringify(batch.committedRows)) fail('Der Importstand ist veraltet oder enthält ungespeicherte Entscheidungen.');
  const pending = batch.rows.filter(r => !batch.committedRows.includes(r.sourceRow)).slice(0, 100);
  if (!pending.length) return null;
  const fingerprints = active(all, 'importFingerprint') as ImportFingerprintAggregate[];
  const changes: P2Aggregate[] = []; const refs = new Set<UUID>([batch.accountId]);
  for (const row of pending) {
    if (row.decision === 'exclude') continue;
    const candidate = row.candidate!;
    parseFinanceDate(candidate.date); assertMoney(candidate.amount);
    const status = duplicateStatus(candidate, batch.accountId, [...fingerprints, ...changes.filter(a => a.aggregateType === 'importFingerprint') as ImportFingerprintAggregate[]]);
    if (status === 'conflict') fail('Gleiche Quell-ID mit anderem Inhalt: zuerst den Prüfkonflikt klären oder ausschließen.');
    if (status === 'duplicate' && row.decision !== 'separate') fail('Eine mögliche Dublette benötigt eine ausdrückliche Entscheidung.');
    if (!candidate.categoryId || !uuidSchema.safeParse(candidate.categoryId).success) fail('Die Importkategorie fehlt.');
    let payeeId = candidate.payeeId;
    if (!payeeId && candidate.payee?.trim()) {
      const normalize = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-AT');
      const matching = [...all, ...changes].filter((a): a is PayeeAggregate => a.aggregateType === 'payee' && a.spaceId === batch.spaceId && !a.deletedAt && !(a as PayeeAggregate).archived).filter(p => [p.name, ...p.aliases].some(name => normalize(name) === normalize(candidate.payee!)));
      if (matching.length > 1) fail('Der Empfängername ist mehrdeutig. Bitte über eine Regel ausdrücklich zuordnen.');
      payeeId = matching[0]?.id;
      if (!payeeId) {
        const payee: PayeeAggregate = { ...createAggregateMetadata(batch.spaceId, deps), aggregateType: 'payee', name: candidate.payee, aliases: [], archived: false };
        const checkedPayee = savePayee({ commandType: 'payee.save', spaceId: batch.spaceId, expectedRevisions: [{ id: payee.id, expectedRevision: 0 }], mutations: [{ aggregate: payee }] }, { get: id => all.find(a => a.id === id) }, deps);
        changes.push(checkedPayee.aggregates[0]!); payeeId = payee.id;
      }
    }
    const tx: TransactionAggregate = { ...createAggregateMetadata(batch.spaceId, deps), aggregateType: 'transaction', kind: 'normal', accountId: batch.accountId, date: candidate.date, amount: candidate.amount, ...(candidate.memo ? { note: candidate.memo } : {}), ...(payeeId ? { payeeId } : {}), clearance: candidate.clearance ?? 'uncleared', importReference: `${batch.id}:${row.sourceRow}`, splits: [{ id: deps.ids.next(), categoryId: candidate.categoryId, amount: candidate.amount }] };
    const checked = checkedTransaction(tx, [...all, ...changes], deps); checked.expectedRevisions.filter(e => e.id !== tx.id).forEach(e => refs.add(e.id)); changes.push(checked.aggregates[0]!);
    changes.push({ ...createAggregateMetadata(batch.spaceId, deps), aggregateType: 'importFingerprint', accountId: batch.accountId, parserSource: candidate.parserSource ?? 'csv', externalId: candidate.externalId, fingerprint: importFingerprint(candidate), transactionId: tx.id, importId: batch.id, sourceRow: row.sourceRow } as ImportFingerprintAggregate);
  }
  // Auch innerhalb der Gruppe sichere Summen erzwingen.
  sumMoney([...all.filter((a): a is TransactionAggregate => a.aggregateType === 'transaction' && !a.deletedAt && a.spaceId === batch.spaceId && (a as TransactionAggregate).accountId === batch.accountId), ...changes.filter((a): a is TransactionAggregate => a.aggregateType === 'transaction')].map(tx => tx.amount));
  const committedRows = [...batch.committedRows, ...pending.map(r => r.sourceRow)];
  changes.push(reviseAggregate(references(all, batch.spaceId, batch.accountId, 'account'), deps));
  changes.push(reviseAggregate({ ...batch, committedRows, state: committedRows.length === batch.rows.length ? 'completed' as const : 'partial' as const }, deps));
  fingerprints.forEach(f => refs.add(f.id));
  return automationChange('import.commit', changes, all, deps, [...refs]);
}
