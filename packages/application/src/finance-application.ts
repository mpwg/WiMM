// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AtomicBatch, UUID } from '@wimm/contracts';
import type { DomainChangeSet, DomainDependencies } from '@wimm/domain';
import { toStoredAggregate, type StoredAggregate, type StoredProjection, type PendingOperation } from '@wimm/storage';
import { FinanceHistory } from './history.js';
export interface WorkspaceStorage {
  initializeArea?(spaceId: UUID, proposedEpoch: UUID): Promise<UUID>;
  query(query: { readonly spaceId: UUID }): Promise<readonly StoredAggregate[]>;
  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void>;
  close?(): Promise<void>;
}
export type WorkspaceStorageFactory = (profileId: UUID) => WorkspaceStorage;
export interface FinanceApplicationState { readonly aggregates: readonly StoredAggregate[]; readonly status: 'loading' | 'ready' | 'error'; readonly saving: boolean; readonly historyVersion: number; readonly message: string | undefined }

/** Anwendung besitzt Commit-/Konflikt-/Historienabläufe; React abonniert ausschließlich Zustand. */
export class FinanceApplication {
  readonly history = new FinanceHistory();
  private value: FinanceApplicationState = { aggregates: [], status: 'loading', saving: false, historyVersion: 0, message: undefined };
  private readonly listeners = new Set<() => void>();
  private active = true;
  constructor(readonly spaceId: UUID, private readonly storage: WorkspaceStorage, readonly dependencies: DomainDependencies, private readonly isProfileChanging: () => boolean) {}
  getSnapshot = (): FinanceApplicationState => this.value;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(update: Partial<FinanceApplicationState>) { this.value = { ...this.value, ...update }; for (const listener of this.listeners) listener(); }
  async load(): Promise<void> {
    if (!this.active) return;
    this.publish({ status: 'loading' });
    try {
      await this.storage.initializeArea?.(this.spaceId, this.dependencies.ids.next());
      const aggregates = await this.storage.query({ spaceId: this.spaceId });
      if (this.active) this.publish({ aggregates, status: 'ready' });
    } catch { if (this.active) this.publish({ status: 'error', message: 'Die lokalen Daten konnten nicht gelesen werden.' }); }
  }
  async execute(change: DomainChangeSet, record = true): Promise<void> {
    if (!this.active || this.value.saving || this.isProfileChanging()) throw new Error('Bitte warten Sie auf die laufende Speicherung oder den Bereichswechsel.');
    if (change.spaceId !== this.spaceId) throw new Error('Die Änderung gehört zu einem anderen Bereich.');
    const before = this.value.aggregates;
    this.publish({ saving: true, message: undefined });
    try {
      try {
        await this.storage.applyAtomicBatch({ expectedRevisions: change.expectedRevisions.map((entry) => ({ handle: entry.id, expectedRevision: entry.expectedRevision })), aggregates: change.aggregates.map(toStoredAggregate), outbox: [], projections: [] });
      } catch (error) {
        this.publish({ message: 'Die Eingaben wurden nicht gespeichert.' });
        if (error instanceof Error && /revision|stale/i.test(error.message)) {
          try { const aggregates = await this.storage.query({ spaceId: this.spaceId }); if (this.active) this.publish({ aggregates }); }
          catch { /* Ursprünglicher Schreibfehler und Entwurf bleiben erhalten. */ }
        }
        throw error;
      }
      // Ausschließlich nach dem bestätigten Commit: keine nachgelagerte Abfrage und kein zweiter Write.
      const changed = new Map(change.aggregates.map((entry) => [entry.id, toStoredAggregate(entry)]));
      const aggregates = [...before.filter((entry) => !changed.has(entry.id)), ...changed.values()];
      if (record) this.history.record(change, before);
      if (this.active) this.publish({ aggregates, status: 'ready', historyVersion: this.value.historyVersion + 1, message: 'Lokal gespeichert.' });
    } finally { if (this.active) this.publish({ saving: false }); }
  }
  async moveHistory(direction: 'undo' | 'redo') {
    if (!this.active || this.value.saving || this.isProfileChanging()) return;
    await this.history.move(direction, this.value.aggregates, this.dependencies, (change) => this.execute(change, false));
    this.publish({ historyVersion: this.value.historyVersion + 1 });
  }
  dispose() { this.active = false; this.listeners.clear(); }
}
