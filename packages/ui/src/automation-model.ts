// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import { automationChange, createAggregateMetadata, reviseAggregate, saveImportBatch, saveRule, deleteRule, reorderRules, saveSchedule, resolveOccurrence, type ImportBatchAggregate, type ImportMappingAggregate, type RuleAggregate, type ScheduleAggregate, type DomainChangeSet } from '@wimm/domain';
import { validateCsvMapping, type CsvMapping } from '@wimm/importers';
import type { FinanceModel } from './workspace.js';

/** Orchestrierung ohne Fachberechnung; alle Writes verwenden den vorhandenen atomaren Speicherport. */
export class AutomationModel {
  constructor(readonly finance: FinanceModel) {}
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
  async next(batch: ImportBatchAggregate, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('Die Importgruppe wurde abgebrochen.');
    const all = this.all;
    const change = await new Promise<DomainChangeSet | null>((resolve, reject) => {
      const worker = new Worker(new URL('./commit-worker.ts', import.meta.url), { type: 'module' });
      let settled = false;
      const cleanup = () => { settled = true; clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate(); };
      const fail = (message: string) => { if (settled) return; cleanup(); reject(new Error(message)); };
      const abort = () => fail('Die Importgruppe wurde abgebrochen.');
      const timeout = setTimeout(() => fail('Die Importgruppe überschreitet das Zeitlimit.'), 30_000);
      worker.onmessage = (event: MessageEvent<{ change?: DomainChangeSet | null; error?: string }>) => {
        if (settled) return;
        cleanup(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.change ?? null);
      };
      worker.onerror = () => fail('Die Importgruppe konnte nicht vorbereitet werden.');
      worker.onmessageerror = () => fail('Die Importgruppe konnte nicht gelesen werden.');
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try { worker.postMessage({ batch, all, occurredAt: this.finance.domainDependencies.clock.now() }); }
      catch { fail('Die Importgruppe konnte nicht an den Worker übergeben werden.'); }
    });
    if (signal?.aborted) throw new Error('Die Importgruppe wurde abgebrochen.');
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
