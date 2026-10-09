// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID, SnapshotProtectionPort } from '@wimm/contracts';
import type { DomainChangeSet, P2Aggregate } from '@wimm/domain';

import {
  type LocalSnapshot,
  type LocalStorageAdapter,
  type PendingOperation,
  type StoredProjection,
  toStoredAggregate,
  type SyncPage
} from './contracts.js';

export interface SnapshotProtector extends SnapshotProtectionPort<LocalSnapshot> {}

export interface LocalAreaMode {
  readonly connected: boolean;
  readonly initialEpoch?: UUID;
}

/** Gemeinsamer Clientdienst; Netzwerktransport und UI bleiben außerhalb dieser Schicht. */
export class LocalAreaService {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly spaceId: UUID,
    private readonly mode: LocalAreaMode
  ) {}

  async applyChangeSet(
    changeSet: DomainChangeSet,
    projections: readonly StoredProjection[] = []
  ): Promise<void> {
    if (changeSet.spaceId !== this.spaceId) throw new TypeError('Die Änderungsmenge gehört zu einem anderen Bereich.');
    await this.initializeArea();
    const outbox = this.mode.connected ? [this.toPending(changeSet)] : [];
    await this.storage.applyAtomicBatch({
      expectedRevisions: changeSet.expectedRevisions.map((entry) => ({ handle: entry.id, expectedRevision: entry.expectedRevision })),
      aggregates: changeSet.aggregates.map((aggregate) => toStoredAggregate(aggregate)),
      outbox,
      projections
    });
  }

  async loadHeads(): Promise<ReadonlyMap<UUID, { readonly id: UUID; readonly spaceId: UUID; readonly revision: number; readonly aggregateType: P2Aggregate['aggregateType'] }>> {
    const aggregates = await this.storage.query({ spaceId: this.spaceId });
    return new Map(aggregates.map((aggregate) => [aggregate.id, {
      id: aggregate.id, spaceId: aggregate.spaceId, revision: aggregate.revision, aggregateType: aggregate.aggregateType
    }]));
  }

  async recoverInterruptedOperations(): Promise<void> {
    if (!this.mode.connected) return;
    const interrupted = (await this.storage.loadPending(this.spaceId))
      .filter((operation) => operation.state === 'sending')
      .map((operation) => ({ ...operation, state: 'queued' as const }));
    if (interrupted.length > 0) {
      await this.storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [], outbox: interrupted, projections: [] });
    }
  }

  async saveSyncPage(page: SyncPage): Promise<void> {
    if (!this.mode.connected) throw new TypeError('Ein lokaler Bereich besitzt keine Syncseite.');
    if (page.state.spaceId !== this.spaceId) throw new TypeError('Die Syncseite gehört zu einem anderen Bereich.');
    await this.storage.saveSyncPage(page);
  }

  async exportEncryptedSnapshot(protector: SnapshotProtector): Promise<Uint8Array> {
    await this.initializeArea();
    return protector.seal(await this.storage.exportSnapshot(this.spaceId));
  }

  private initializeArea(): Promise<UUID> {
    return this.storage.initializeArea(this.spaceId, this.mode.initialEpoch ?? crypto.randomUUID() as UUID);
  }

  async replaceEncryptedSnapshot(protector: SnapshotProtector, bytes: Uint8Array): Promise<void> {
    const snapshot = await protector.unseal(bytes);
    if (snapshot.spaceId !== this.spaceId) throw new TypeError('Der Snapshot gehört zu einem anderen Bereich.');
    await this.storage.replaceSnapshot(snapshot);
  }

  private toPending(changeSet: DomainChangeSet): PendingOperation {
    return {
      operationId: changeSet.operationId,
      spaceId: changeSet.spaceId,
      expectedRevisions: changeSet.expectedRevisions.map((entry) => ({ handle: entry.id, expectedRevision: entry.expectedRevision })),
      dependsOn: [],
      state: 'queued',
      draft: changeSet,
      retryCount: 0,
      createdAt: changeSet.occurredAt
    };
  }
}
