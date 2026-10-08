// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AtomicBatch, RevisionExpectation } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';

import {
  assertExpectedRevision,
  type ConfirmedAggregate,
  type LocalSnapshot,
  type LocalStorageAdapter,
  type PendingOperation,
  type StorageFaultInjector,
  type StoredAggregate,
  type StoredProjection,
  type SyncPage,
  type SyncState,
  StorageWriteError
} from './contracts.js';

/** Referenzimplementierung der Transaktionssemantik für die Adapterkonformitätssuite. */
export class MemoryStorageAdapter implements LocalStorageAdapter {
  readonly profileId: UUID;
  private writes: Promise<void> = Promise.resolve();
  private aggregates = new Map<UUID, StoredAggregate>();
  private confirmed = new Map<UUID, ConfirmedAggregate>();
  private pending = new Map<UUID, PendingOperation>();
  private projections = new Map<string, StoredProjection>();
  private syncStates = new Map<UUID, SyncState>();
  private localEpochs = new Map<UUID, UUID>();

  constructor(profileId: UUID, private readonly faults: StorageFaultInjector = {}) {
    this.profileId = profileId;
  }

  initializeArea(spaceId: UUID, proposedEpoch: UUID): Promise<UUID> {
    return this.serialize(async () => {
      const epoch = this.localEpochs.get(spaceId) ?? this.syncStates.get(spaceId)?.epoch ?? snapshotEpoch(this.confirmed, spaceId) ?? proposedEpoch;
      this.localEpochs.set(spaceId, epoch);
      return epoch;
    });
  }

  async readAggregate(handle: UUID): Promise<StoredAggregate | undefined> {
    return clone(this.aggregates.get(handle));
  }

  async query(query: { readonly spaceId: UUID }): Promise<readonly StoredAggregate[]> {
    return [...this.aggregates.values()]
      .filter((aggregate) => aggregate.spaceId === query.spaceId)
      .map((aggregate) => clone(aggregate)!);
  }

  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void> {
    return this.serialize(() => this.applyAtomicBatchExclusive(batch));
  }

  private async applyAtomicBatchExclusive(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void> {
    const next = this.copy();
    assertBatch(next.aggregates, batch.expectedRevisions);
    for (const aggregate of batch.aggregates) next.aggregates.set(aggregate.handle, clone(aggregate)!);
    for (const pending of batch.outbox) next.pending.set(pending.operationId, clone(pending)!);
    for (const projection of batch.projections) next.projections.set(projectionKey(projection), clone(projection)!);
    await this.faults.beforeCommit?.('applyAtomicBatch');
    this.replace(next);
  }

  async loadConfirmed(spaceId: UUID): Promise<readonly ConfirmedAggregate[]> {
    return [...this.confirmed.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!);
  }

  async loadPending(spaceId: UUID): Promise<readonly PendingOperation[]> {
    return [...this.pending.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!);
  }

  saveSyncPage(page: SyncPage): Promise<void> {
    return this.serialize(() => this.saveSyncPageExclusive(page));
  }

  private async saveSyncPageExclusive(page: SyncPage): Promise<void> {
    if (page.state.profileId !== this.profileId) throw new StorageWriteError('Das Profil der Syncseite passt nicht.');
    const next = this.copy();
    for (const entry of page.confirmed) next.confirmed.set(entry.aggregate.handle, clone(entry)!);
    for (const id of page.removeOperationIds) next.pending.delete(id);
    for (const projection of page.projections) next.projections.set(projectionKey(projection), clone(projection)!);
    next.syncStates.set(page.state.spaceId, clone(page.state)!);
    next.localEpochs.set(page.state.spaceId, page.state.epoch);
    await this.faults.beforeCommit?.('saveSyncPage');
    this.replace(next);
  }

  async getSyncState(spaceId: UUID): Promise<SyncState | undefined> {
    return clone(this.syncStates.get(spaceId));
  }

  async exportSnapshot(spaceId: UUID): Promise<LocalSnapshot> {
    return this.serialize(async () => {
      const state = this.syncStates.get(spaceId);
      const epoch = state?.epoch ?? this.localEpochs.get(spaceId) ?? snapshotEpoch(this.confirmed, spaceId);
      if (epoch === undefined) throw new StorageWriteError('Für den Bereich fehlt eine Epoche.');
      return { storageSchemaVersion: 1, domainSchemaVersion: 1, profileId: this.profileId, spaceId, epoch,
        aggregates: [...this.aggregates.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!),
        confirmed: [...this.confirmed.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!),
        pending: [...this.pending.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!),
        projections: [...this.projections.values()].filter((entry) => entry.spaceId === spaceId).map((entry) => clone(entry)!), syncState: clone(state) };
    });
  }

  replaceSnapshot(snapshot: LocalSnapshot): Promise<void> {
    return this.serialize(() => this.replaceSnapshotExclusive(snapshot));
  }

  private async replaceSnapshotExclusive(snapshot: LocalSnapshot): Promise<void> {
    if (snapshot.profileId !== this.profileId) throw new StorageWriteError('Der Snapshot gehört zu einem anderen Profil.');
    const next = this.copy();
    next.clearSpace(snapshot.spaceId);
    for (const aggregate of snapshot.aggregates) next.aggregates.set(aggregate.handle, clone(aggregate)!);
    for (const confirmed of snapshot.confirmed) next.confirmed.set(confirmed.aggregate.handle, clone(confirmed)!);
    for (const pending of snapshot.pending) next.pending.set(pending.operationId, clone(pending)!);
    for (const projection of snapshot.projections) next.projections.set(projectionKey(projection), clone(projection)!);
    if (snapshot.syncState !== undefined) next.syncStates.set(snapshot.spaceId, clone(snapshot.syncState)!);
    next.localEpochs.set(snapshot.spaceId, snapshot.epoch);
    await this.faults.beforeCommit?.('replaceSnapshot');
    this.replace(next);
  }

  rebuildProjections(spaceId: UUID): Promise<void> {
    return this.serialize(() => this.rebuildProjectionsExclusive(spaceId));
  }

  private async rebuildProjectionsExclusive(spaceId: UUID): Promise<void> {
    for (const [key, projection] of this.projections) if (projection.spaceId === spaceId) this.projections.delete(key);
  }

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = this.writes.then(action);
    this.writes = result.then(() => {}, () => {});
    return result;
  }

  private copy(): MemoryStorageAdapter {
    const copy = new MemoryStorageAdapter(this.profileId, this.faults);
    copy.aggregates = cloneMap(this.aggregates);
    copy.confirmed = cloneMap(this.confirmed);
    copy.pending = cloneMap(this.pending);
    copy.projections = cloneMap(this.projections);
    copy.syncStates = cloneMap(this.syncStates);
    copy.localEpochs = cloneMap(this.localEpochs);
    return copy;
  }

  private replace(other: MemoryStorageAdapter): void {
    this.aggregates = other.aggregates;
    this.confirmed = other.confirmed;
    this.pending = other.pending;
    this.projections = other.projections;
    this.syncStates = other.syncStates;
    this.localEpochs = other.localEpochs;
  }

  private clearSpace(spaceId: UUID): void {
    for (const [key, aggregate] of this.aggregates) if (aggregate.spaceId === spaceId) this.aggregates.delete(key);
    for (const [key, entry] of this.confirmed) if (entry.spaceId === spaceId) this.confirmed.delete(key);
    for (const [key, entry] of this.pending) if (entry.spaceId === spaceId) this.pending.delete(key);
    for (const [key, entry] of this.projections) if (entry.spaceId === spaceId) this.projections.delete(key);
    this.syncStates.delete(spaceId);
    this.localEpochs.delete(spaceId);
  }
}

function assertBatch(aggregates: ReadonlyMap<UUID, StoredAggregate>, expected: readonly RevisionExpectation[]): void {
  for (const expectation of expected) assertExpectedRevision(aggregates.get(expectation.handle), expectation.expectedRevision);
}

function snapshotEpoch(entries: ReadonlyMap<UUID, ConfirmedAggregate>, spaceId: UUID): UUID | undefined {
  return [...entries.values()].find((entry) => entry.spaceId === spaceId)?.epoch;
}

function projectionKey(projection: StoredProjection): string {
  return `${projection.spaceId}:${projection.kind}:${projection.key}`;
}

function clone<T>(value: T): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function cloneMap<TKey, TValue>(source: ReadonlyMap<TKey, TValue>): Map<TKey, TValue> {
  return new Map([...source].map(([key, value]) => [key, clone(value)!]));
}
