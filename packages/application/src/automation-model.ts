// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID, CancellationPort, BackgroundExecutionPort } from '@wimm/contracts';
import { automationChange, createAggregateMetadata, reviseAggregate, saveImportBatch, saveRule, deleteRule, reorderRules, saveSchedule, resolveOccurrence, type ImportBatchAggregate, type ImportMappingAggregate, type RuleAggregate, type ScheduleAggregate, type DomainChangeSet } from '@wimm/domain';
import { validateCsvMapping, type CsvMapping } from '@wimm/importers';
import type { FinanceModel } from './finance-model.js';

export interface ImportPreparationInput { readonly batch: ImportBatchAggregate; readonly all: readonly import('@wimm/domain').P2Aggregate[]; readonly occurredAt: string }

/** Orchestrierung ohne Fachberechnung; alle Writes verwenden den vorhandenen atomaren Speicherport. */
export class AutomationModel {
  constructor(readonly finance: FinanceModel, private readonly preparation: BackgroundExecutionPort<ImportPreparationInput, DomainChangeSet | null>) {}
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
  async start(batch: ImportBatchAggregate) { await this.finance.commitAutomation(saveImportBatch(batch, this.all, this.finance.domainDependencies)); }
  async next(batch: ImportBatchAggregate, cancellation: CancellationPort = { isCancelled: () => false, onCancel: () => () => {} }) {
    if (cancellation.isCancelled()) throw new Error('Die Importgruppe wurde abgebrochen.');
    const change = await this.preparation.execute({ batch, all: this.all, occurredAt: this.finance.domainDependencies.clock.now() }, cancellation);
    if (cancellation.isCancelled()) throw new Error('Die Importgruppe wurde abgebrochen.');
    if (change) await this.finance.commitAutomation(change);
  }
  async rule(rule: RuleAggregate) { await this.finance.commitAutomation(saveRule(rule, this.all, this.finance.domainDependencies)); }
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
