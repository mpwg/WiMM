// SPDX-License-Identifier: AGPL-3.0-or-later
import { Dexie, type Table } from 'dexie';
import type { AtomicBatch, RevisionExpectation } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';

import {
  assertExpectedRevision,
  type ConfirmedAggregate,
  type LocalSnapshot,
  type LocalStorageAdapter,
  type PendingOperation,
  type StoredAggregate,
  type StoredProjection,
  type SyncPage,
  type SyncState,
  StorageWriteError
} from './contracts.js';

interface AggregateRow { profileId: UUID; handle: UUID; spaceId: UUID; payload: StoredAggregate; }
interface ConfirmedRow { profileId: UUID; handle: UUID; spaceId: UUID; payload: ConfirmedAggregate; }
interface PendingRow { profileId: UUID; operationId: UUID; spaceId: UUID; payload: PendingOperation; }
interface ProjectionRow { profileId: UUID; spaceId: UUID; kind: string; key: string; payload: StoredProjection; }
interface SyncRow { profileId: UUID; spaceId: UUID; payload: SyncState; }

class WimmDexie extends Dexie {
  aggregates!: Table<AggregateRow, [UUID, UUID]>;
  confirmed!: Table<ConfirmedRow, [UUID, UUID]>;
  pending!: Table<PendingRow, [UUID, UUID]>;
  projections!: Table<ProjectionRow, [UUID, UUID, string, string]>;
  syncStates!: Table<SyncRow, [UUID, UUID]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      aggregates: '[profileId+handle], [profileId+spaceId]',
      confirmed: '[profileId+handle], [profileId+spaceId]',
      pending: '[profileId+operationId], [profileId+spaceId], [profileId+spaceId+payload.state]',
      projections: '[profileId+spaceId+kind+key], [profileId+spaceId]',
      syncStates: '[profileId+spaceId]'
    });
  }
}

/** Dexie-Adapter mit denselben atomaren Grenzen wie die Desktop-Implementierung. */
export class IndexedDbStorageAdapter implements LocalStorageAdapter {
  readonly profileId: UUID;
  private readonly db: WimmDexie;

  constructor(profileId: UUID, databaseName = `wimm-${profileId}`) {
    this.profileId = profileId;
    this.db = new WimmDexie(databaseName);
  }

  async readAggregate(handle: UUID): Promise<StoredAggregate | undefined> {
    return (await this.db.aggregates.get([this.profileId, handle]))?.payload;
  }

  async query(query: { readonly spaceId: UUID }): Promise<readonly StoredAggregate[]> {
    return (await this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, query.spaceId]).toArray())
      .map((entry) => entry.payload);
  }

  async applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void> {
    await this.write(async () => this.db.transaction(
      'rw', this.db.aggregates, this.db.pending, this.db.projections,
      async () => {
        await assertBatch(this.db, this.profileId, batch.expectedRevisions);
        await this.db.aggregates.bulkPut(batch.aggregates.map((payload) => ({ profileId: this.profileId, handle: payload.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkPut(batch.outbox.map((payload) => ({ profileId: this.profileId, operationId: payload.operationId, spaceId: payload.spaceId, payload })));
        await this.db.projections.bulkPut(batch.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
      }
    ));
  }

  async loadConfirmed(spaceId: UUID): Promise<readonly ConfirmedAggregate[]> {
    return (await this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()).map((entry) => entry.payload);
  }

  async loadPending(spaceId: UUID): Promise<readonly PendingOperation[]> {
    return (await this.db.pending.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()).map((entry) => entry.payload);
  }

  async saveSyncPage(page: SyncPage): Promise<void> {
    if (page.state.profileId !== this.profileId) throw new StorageWriteError('Das Profil der Syncseite passt nicht.');
    await this.write(async () => this.db.transaction(
      'rw', this.db.confirmed, this.db.pending, this.db.projections, this.db.syncStates,
      async () => {
        await this.db.confirmed.bulkPut(page.confirmed.map((payload) => ({ profileId: this.profileId, handle: payload.aggregate.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkDelete(page.removeOperationIds.map((id) => [this.profileId, id] as [UUID, UUID]));
        await this.db.projections.bulkPut(page.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
        await this.db.syncStates.put({ profileId: this.profileId, spaceId: page.state.spaceId, payload: page.state });
      }
    ));
  }

  async getSyncState(spaceId: UUID): Promise<SyncState | undefined> {
    return (await this.db.syncStates.get([this.profileId, spaceId]))?.payload;
  }

  async exportSnapshot(spaceId: UUID): Promise<LocalSnapshot> {
    const syncState = await this.getSyncState(spaceId);
    const confirmed = await this.loadConfirmed(spaceId);
    const epoch = syncState?.epoch ?? confirmed[0]?.epoch;
    if (epoch === undefined) throw new StorageWriteError('Für den Bereich fehlt eine Epoche.');
    return {
      storageSchemaVersion: 1, domainSchemaVersion: 1, profileId: this.profileId, spaceId, epoch,
      aggregates: await this.query({ spaceId }), confirmed, pending: await this.loadPending(spaceId),
      projections: (await this.db.projections.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()).map((entry) => entry.payload),
      syncState
    };
  }

  async replaceSnapshot(snapshot: LocalSnapshot): Promise<void> {
    if (snapshot.profileId !== this.profileId) throw new StorageWriteError('Der Snapshot gehört zu einem anderen Profil.');
    await this.write(async () => this.db.transaction(
      'rw', [this.db.aggregates, this.db.confirmed, this.db.pending, this.db.projections, this.db.syncStates],
      async () => {
        await this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.pending.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.projections.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.syncStates.delete([this.profileId, snapshot.spaceId]);
        await this.db.aggregates.bulkPut(snapshot.aggregates.map((payload) => ({ profileId: this.profileId, handle: payload.handle, spaceId: payload.spaceId, payload })));
        await this.db.confirmed.bulkPut(snapshot.confirmed.map((payload) => ({ profileId: this.profileId, handle: payload.aggregate.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkPut(snapshot.pending.map((payload) => ({ profileId: this.profileId, operationId: payload.operationId, spaceId: payload.spaceId, payload })));
        await this.db.projections.bulkPut(snapshot.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
        if (snapshot.syncState !== undefined) await this.db.syncStates.put({ profileId: this.profileId, spaceId: snapshot.spaceId, payload: snapshot.syncState });
      }
    ));
  }

  async rebuildProjections(spaceId: UUID): Promise<void> {
    await this.write(async () => this.db.projections.where('[profileId+spaceId]').equals([this.profileId, spaceId]).delete());
  }

  async close(): Promise<void> { this.db.close(); }

  private async write(operation: () => Promise<unknown>): Promise<void> {
    try { await operation(); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageWriteError('Der Browserspeicher ist voll. Eingaben bleiben erhalten.', 'QUOTA');
      }
      throw error;
    }
  }
}

async function assertBatch(db: WimmDexie, profileId: UUID, expected: readonly RevisionExpectation[]): Promise<void> {
  for (const entry of expected) assertExpectedRevision((await db.aggregates.get([profileId, entry.handle]))?.payload, entry.expectedRevision);
}

/** Fragt dauerhafte Browserpersistenz an; die Oberfläche kann Ablehnung sichtbar erklären. */
export async function requestPersistentBrowserStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) return false;
  return navigator.storage.persist();
}
