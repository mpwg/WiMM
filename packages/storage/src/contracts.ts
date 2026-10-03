// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AtomicBatch, RevisionExpectation, StorageAdapter } from '@wimm/contracts';
import type { Revision, UUID } from '@wimm/contracts';
import type { P2Aggregate } from '@wimm/domain';

export const STORAGE_SCHEMA_VERSION = 1 as const;
export const DOMAIN_SCHEMA_VERSION = 1 as const;

export interface StoredAggregate extends P2Aggregate {
  readonly handle: UUID;
}

export interface ConfirmedAggregate {
  readonly spaceId: UUID;
  readonly epoch: UUID;
  readonly aggregate: StoredAggregate;
}

export type PendingState = 'queued' | 'sending' | 'accepted' | 'conflict' | 'blocked' | 'forbidden' | 'invalid';

export interface PendingOperation {
  readonly operationId: UUID;
  readonly spaceId: UUID;
  readonly expectedRevisions: readonly RevisionExpectation[];
  readonly dependsOn: readonly UUID[];
  readonly state: PendingState;
  readonly draft: unknown;
  readonly retryCount: number;
}

export interface StoredProjection {
  readonly spaceId: UUID;
  readonly kind: string;
  readonly key: string;
  readonly payload: unknown;
}

export interface SyncState {
  readonly profileId: UUID;
  readonly spaceId: UUID;
  readonly epoch: UUID;
  readonly cursor: string;
}

/** Eine bereits vollständig geprüfte Pull-Seite; Cursor und Daten werden zusammen persistiert. */
export interface SyncPage {
  readonly state: SyncState;
  readonly confirmed: readonly ConfirmedAggregate[];
  readonly removeOperationIds: readonly UUID[];
  readonly projections: readonly StoredProjection[];
}

/** Das unverschlüsselte Zwischenformat verlässt den Client nie ohne Snapshotport aus P3.2. */
export interface LocalSnapshot {
  readonly storageSchemaVersion: number;
  readonly domainSchemaVersion: number;
  readonly profileId: UUID;
  readonly spaceId: UUID;
  readonly epoch: UUID;
  readonly aggregates: readonly StoredAggregate[];
  readonly confirmed: readonly ConfirmedAggregate[];
  readonly pending: readonly PendingOperation[];
  readonly projections: readonly StoredProjection[];
  readonly syncState: SyncState | undefined;
}

export interface StorageFaultInjector {
  beforeCommit?(operation: 'applyAtomicBatch' | 'saveSyncPage' | 'replaceSnapshot'): void | Promise<void>;
}

export interface LocalStorageAdapter extends StorageAdapter<
  StoredAggregate,
  { readonly spaceId: UUID },
  ConfirmedAggregate,
  PendingOperation,
  SyncPage,
  LocalSnapshot,
  StoredProjection
> {
  readonly profileId: UUID;
  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void>;
  getSyncState(spaceId: UUID): Promise<SyncState | undefined>;
}

export class StorageRevisionConflictError extends Error {
  constructor() {
    super('Die lokale Revision ist nicht mehr aktuell.');
    this.name = 'StorageRevisionConflictError';
  }
}

export class StorageWriteError extends Error {
  constructor(message: string, readonly causeCode: 'QUOTA' | 'WRITE_FAILED' = 'WRITE_FAILED') {
    super(message);
    this.name = 'StorageWriteError';
  }
}

export function aggregateHandle(aggregate: P2Aggregate): UUID {
  return aggregate.id;
}

export function toStoredAggregate<TAggregate extends P2Aggregate>(
  aggregate: TAggregate
): TAggregate & { readonly handle: UUID } {
  return { ...aggregate, handle: aggregateHandle(aggregate) };
}

export function assertExpectedRevision(
  current: StoredAggregate | undefined,
  expected: Revision
): void {
  if ((current?.revision ?? 0) !== expected) throw new StorageRevisionConflictError();
}
