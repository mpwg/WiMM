// SPDX-License-Identifier: AGPL-3.0-or-later
import { StorageFailureError, type StorageFailureCode } from './storage-failure.js';
import type { AtomicBatch, RevisionExpectation, LocalFinancialStoragePort } from '@wimm/contracts';
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
  readonly createdAt?: string;
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
  beforeCommit?(operation: 'applyAtomicBatch' | 'saveSyncPage' | 'replaceSnapshot' | 'rebuildProjections'): void | Promise<void>;
}

export interface LocalStorageAdapter extends LocalFinancialStoragePort<
  StoredAggregate,
  { readonly spaceId: UUID },
  ConfirmedAggregate,
  PendingOperation,
  SyncPage,
  LocalSnapshot,
  StoredProjection,
  SyncState
> {
  readonly profileId: UUID;
  initializeArea(spaceId: UUID, proposedEpoch: UUID): Promise<UUID>;
  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void>;
  getSyncState(spaceId: UUID): Promise<SyncState | undefined>;
}

export class StorageRevisionConflictError extends StorageFailureError {
  constructor() {
    super('REVISION_CONFLICT');
    this.name = 'StorageRevisionConflictError';
  }
}

export class StorageWriteError extends StorageFailureError {
  constructor(message: string, causeCode: StorageFailureCode = 'WRITE_FAILED') {
    super(causeCode);
    this.message = message;
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

/** Vollständiger gelesener Ausgangsbestand als CAS für den nativen Cacheersatz. */
export interface ProjectionRebuild {
  readonly spaceId: UUID;
  readonly sourceAggregates: readonly StoredAggregate[];
  readonly projections: readonly StoredProjection[];
}
