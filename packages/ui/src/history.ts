// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import { reverseFinanceAction, type DomainChangeSet, type DomainDependencies, type FinanceInverse, type P2Aggregate } from '@wimm/domain';

type HistoryEntry = FinanceInverse & { readonly observed: readonly P2Aggregate[] };
function canonical(value: unknown): unknown { if (Array.isArray(value)) return value.map(canonical); if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonical(entry)])); return value; }
function content(aggregate: P2Aggregate) { const { revision: _revision, updatedAt: _updated, deletedAt, ...fields } = aggregate; return JSON.stringify(canonical({ ...Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'handle')), deleted: deletedAt !== undefined })); }

export class FinanceHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack = []; this.redoStack = []; }
  record(change: DomainChangeSet, before: readonly P2Aggregate[]) {
    if (!['transaction.save', 'transaction.delete', 'transfer.save', 'transfer.delete', 'reconciliation.confirm', 'reconciliation.unlock'].includes(change.commandType)) { this.clear(); return; }
    this.undoStack.push(this.inverse(change, before)); this.redoStack = [];
  }
  async move(direction: 'undo' | 'redo', before: readonly P2Aggregate[], dependencies: DomainDependencies, execute: (change: DomainChangeSet) => Promise<void>) {
    const source = direction === 'undo' ? this.undoStack : this.redoStack;
    const target = direction === 'undo' ? this.redoStack : this.undoStack;
    const entry = source.at(-1); if (entry === undefined) return;
    const change = reverseFinanceAction(entry, before, dependencies);
    await execute(change);
    source.pop(); target.push(this.inverse(change, before));
    // Eigene Gegenbefehle erhöhen Revisionen; ältere Aktionen derselben Kette
    // dürfen nur diese nachweislich eigenen Übergänge übernehmen.
    const revisions = new Map(change.aggregates.map((aggregate) => [aggregate.id, aggregate.revision]));
    const changed = new Map(change.aggregates.map((aggregate) => [aggregate.id, aggregate]));
    for (let index = 0; index < source.length; index += 1) {
      const previous = source[index]!;
      source[index] = { ...previous, expectedRevisions: previous.expectedRevisions.map((expectation) => {
        const revision = revisions.get(expectation.id);
        return revision !== undefined && previous.observed.some((aggregate) => aggregate.id === expectation.id && content(aggregate) === content(changed.get(expectation.id)!)) ? { ...expectation, expectedRevision: revision } : expectation;
      }) };
    }
  }
  private inverse(change: DomainChangeSet, before: readonly P2Aggregate[]): HistoryEntry {
    const previous = new Map(before.map((aggregate) => [aggregate.id, aggregate]));
    const changed = new Map<UUID, P2Aggregate>(change.aggregates.map((aggregate) => [aggregate.id, aggregate]));
    return { observed: change.aggregates, spaceId: change.spaceId, expectedRevisions: change.expectedRevisions.map((expectation) => ({ ...expectation, expectedRevision: changed.get(expectation.id)?.revision ?? expectation.expectedRevision })), targets: change.aggregates.filter(aggregate => aggregate.aggregateType !== 'account').map((aggregate) => {
      const value = previous.get(aggregate.id); return { id: aggregate.id, ...(value === undefined ? {} : { previous: value }) };
    }) };
  }
}
