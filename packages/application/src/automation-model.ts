// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID, CancellationPort, BackgroundExecutionPort } from '@wimm/contracts';
import { dueDates, parseFinanceDate, parseMoney, applyRules, classifyImportCandidates, automationChange, createAggregateMetadata, reviseAggregate, saveImportBatch, saveRule, deleteRule, reorderRules, saveSchedule, resolveOccurrence, type ImportBatchAggregate, type ImportMappingAggregate, type RuleAggregate, type ScheduleAggregate, type DomainChangeSet, type ImportCandidate, type ImportDecision, type ImportFingerprintAggregate, type OccurrenceAggregate } from '@wimm/domain';
import { validateCsvMapping, type CsvMapping, type ImportFormat, type PreviewRow } from '@wimm/importers';
import type { FinanceModel } from './finance-model.js';

export interface ImportPreviewInput { readonly file: { readonly bytes: Uint8Array }; readonly mapping: CsvMapping; readonly format: ImportFormat }
export interface ImportPreviewOutput { readonly fileHash: string; readonly rows: readonly PreviewRow[] }
export interface ImportPreviewSelection { readonly accountId: UUID; readonly categoryId: UUID; readonly format: ImportFormat; readonly fileHash: string; readonly preview: readonly PreviewRow[]; readonly decisions: Readonly<Record<number, ImportDecision>> }
export interface ImportPreparationInput { readonly batch: ImportBatchAggregate; readonly all: readonly import('@wimm/domain').P2Aggregate[]; readonly occurredAt: string }

/** Orchestrierung ohne Fachberechnung; alle Writes verwenden den vorhandenen atomaren Speicherport. */
export class AutomationModel {
  constructor(readonly finance: FinanceModel, private readonly preparation: BackgroundExecutionPort<ImportPreparationInput, DomainChangeSet | null>, private readonly preview?: BackgroundExecutionPort<ImportPreviewInput, ImportPreviewOutput>) {}
  get all() { return this.finance.allAggregates; }
  get rules() { return this.all.filter((a): a is RuleAggregate => a.aggregateType === 'rule' && !a.deletedAt); }
  get schedules() { return this.all.filter((a): a is ScheduleAggregate => a.aggregateType === 'schedule' && !a.deletedAt); }
  get batches() { return this.all.filter((a): a is ImportBatchAggregate => a.aggregateType === 'importBatch' && !a.deletedAt); }
  get mappings() { return this.all.filter((a): a is ImportMappingAggregate => a.aggregateType === 'importMapping' && !a.deletedAt); }
  metadata() { return createAggregateMetadata(this.finance.activeSpaceId, this.finance.domainDependencies); }
  async saveMapping(mapping: CsvMapping) {
    validateCsvMapping(mapping);
    const prior = this.mappings.find(a => a.name === mapping.name);
    const aggregate: ImportMappingAggregate = prior ? reviseAggregate({ ...prior, mapping }, this.finance.domainDependencies) : { ...this.metadata(), aggregateType: 'importMapping', name: mapping.name, mapping };
    await this.finance.commitAutomation(automationChange('importMapping.save', [aggregate], this.all, this.finance.domainDependencies));
  }
  async previewFile(input: ImportPreviewInput, cancellation: CancellationPort): Promise<ImportPreviewOutput> {
    if (this.preview === undefined) throw new Error('Die Importvorschau ist nicht angebunden.');
    if (cancellation.isCancelled()) throw new Error('Die Importvorschau wurde abgebrochen.');
    const result = await this.preview.execute(input, cancellation);
    if (cancellation.isCancelled()) throw new Error('Die Importvorschau wurde abgebrochen.');
    return result;
  }
  ruleResult(row: PreviewRow, format: ImportFormat, categoryId?: UUID) {
    try {
      if (!row.record) return null;
      const {sourceRow,date,amount,payee,memo,externalId}=row.record;
      const candidate:ImportCandidate={sourceRow,date,amount,parserSource:format,
        ...(payee===undefined?{}:{payee}),...(memo===undefined?{}:{memo}),...(externalId===undefined?{}:{externalId}),...(categoryId?{categoryId}:{})};
      return applyRules(candidate,this.rules,this.all,this.finance.activeSpaceId);
    } catch { return null; }
  }
  duplicateStates(rows: readonly PreviewRow[], decisions: Readonly<Record<number, ImportDecision>>, format: ImportFormat, accountId: UUID) {
    return classifyImportCandidates(rows.flatMap((row) => row.record && decisions[row.source.sourceRow] !== 'exclude' ? [{ ...row.record, parserSource: format }] : []), accountId, this.all.filter((entry): entry is ImportFingerprintAggregate => entry.aggregateType === 'importFingerprint'));
  }
  async startPreview(selection: ImportPreviewSelection) {
    if (!selection.accountId || !selection.categoryId) throw new Error('Konto und Kategorie ausdrücklich auswählen.');
    const states = this.duplicateStates(selection.preview, selection.decisions, selection.format, selection.accountId);
    const rows = selection.preview.map((row) => {
      const candidate: ImportCandidate | null = this.ruleResult(row, selection.format, selection.categoryId)?.candidate ?? null;
      const state = row.record && candidate ? states.get(row.source.sourceRow) ?? 'new' : 'invalid';
      const decision = selection.decisions[row.source.sourceRow] ?? (state === 'new' ? 'import' : undefined);
      if (!decision) throw new Error('Jede fehlerhafte Zeile und Dublette benötigt eine ausdrückliche Entscheidung.');
      return { sourceRow: row.source.sourceRow, candidate, decision, issues: row.issues.map((issue) => issue.message) };
    });
    await this.start({ ...this.metadata(), aggregateType: 'importBatch', fileHash: selection.fileHash, accountId: selection.accountId, rows, committedRows: [], state: 'ready' });
  }
  async start(batch: ImportBatchAggregate) { await this.finance.commitAutomation(saveImportBatch(batch, this.all, this.finance.domainDependencies)); }
  async next(batch: ImportBatchAggregate, cancellation: CancellationPort = { isCancelled: () => false, onCancel: () => () => {} }) {
    if (cancellation.isCancelled()) throw new Error('Die Importgruppe wurde abgebrochen.');
    const change = await this.preparation.execute({ batch, all: this.all, occurredAt: this.finance.domainDependencies.clock.now() }, cancellation);
    if (cancellation.isCancelled()) throw new Error('Die Importgruppe wurde abgebrochen.');
    if (change) await this.finance.commitAutomation(change);
  }
  ruleInput(input: { field: RuleAggregate['conditions'][number]['field']; operator: RuleAggregate['conditions'][number]['operator']; condition: string; actionField: 'categoryId' | 'payeeId' | 'clearance'; actionValue: string; stop: boolean }, previous?: RuleAggregate) {
    return this.rule({ ...(previous ? reviseAggregate(previous, this.finance.domainDependencies) : this.metadata()), aggregateType: 'rule', order: previous?.order ?? this.rules.length, enabled: previous?.enabled ?? true, stopProcessing: input.stop,
      conditions: [{ field: input.field, operator: input.operator, value: input.field === 'amount' ? parseMoney(input.condition) : input.condition }, ...(previous?.conditions.slice(1) ?? [])],
      actions: [input.actionField === 'clearance' ? { field: 'clearance', value: input.actionValue as 'uncleared' | 'cleared' } : { field: input.actionField, value: input.actionValue }, ...(previous?.actions.slice(1) ?? [])] });
  }
  scheduleInput(input: { accountId: UUID; categoryId: UUID; amount: string; start: string; end: string; frequency: ScheduleAggregate['frequency']; interval: string; note: string }, previous?: ScheduleAggregate) {
    const { endDate: _oldEnd, ...base } = previous ? reviseAggregate(previous, this.finance.domainDependencies) : { ...this.metadata(), endDate: undefined };
    const amount = parseMoney(input.amount);
    return this.schedule({ ...base, aggregateType: 'schedule', startDate: parseFinanceDate(input.start), ...(input.end ? { endDate: parseFinanceDate(input.end) } : {}), frequency: input.frequency, interval: Number(input.interval), enabled: previous?.enabled ?? true,
      template: { accountId: input.accountId, amount, kind: 'normal', clearance: 'uncleared', note: input.note, splits: [{ id: previous?.template.splits[0]?.id ?? this.finance.domainDependencies.ids.next(), categoryId: input.categoryId, amount }] } });
  }
  toggleSchedule(schedule: ScheduleAggregate) { return this.schedule(reviseAggregate({ ...schedule, enabled: !schedule.enabled }, this.finance.domainDependencies)); }
  pendingOccurrences(schedule: ScheduleAggregate, through: string) { return dueDates(schedule, parseFinanceDate(through)).filter((date) => !this.all.some((item) => item.aggregateType === 'scheduleOccurrence' && (item as OccurrenceAggregate).scheduleId === schedule.id && (item as OccurrenceAggregate).dueDate === date)); }
  nextOccurrences(through: string, limit: number) { return this.schedules.filter((schedule) => schedule.enabled).flatMap((schedule) => this.pendingOccurrences(schedule, through).map((date) => ({ schedule, date }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit); }
  async rule(rule: RuleAggregate) { await this.finance.commitAutomation(saveRule(rule, this.all, this.finance.domainDependencies)); }
  toggleRule(rule: RuleAggregate) { return this.rule(reviseAggregate({ ...rule, enabled: !rule.enabled }, this.finance.domainDependencies)); }
  async removeRule(rule: RuleAggregate) { await this.finance.commitAutomation(deleteRule(rule, this.all, this.finance.domainDependencies)); }
  async order(ids: UUID[]) { await this.finance.commitAutomation(reorderRules(ids, this.rules, this.all, this.finance.domainDependencies)); }
  async schedule(schedule: ScheduleAggregate) { await this.finance.commitAutomation(saveSchedule(schedule, this.all, this.finance.domainDependencies)); }
  async occurrence(schedule: ScheduleAggregate, date: string, state: 'confirmed' | 'skipped', transactionId?: UUID) {
    const imported = transactionId ? this.finance.transactions.find(t => t.id === transactionId) : undefined;
    if (transactionId && !imported) throw new Error('Die importierte Buchung fehlt.');
    const change = resolveOccurrence(schedule, date as never, state, this.all, this.finance.domainDependencies, imported);
    if (change) await this.finance.commitAutomation(change);
  }
  async editBatch(batch: ImportBatchAggregate, rows: ImportBatchAggregate['rows']) {
    const aggregate = reviseAggregate({ ...batch, rows }, this.finance.domainDependencies);
    await this.finance.commitAutomation(saveImportBatch(aggregate, this.all, this.finance.domainDependencies));
  }
}
