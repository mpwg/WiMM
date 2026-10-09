// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID, UtcTimestamp, Revision, Base64Url } from './primitives.js';
import type { AtomicBatch, StorageAdapter, RevisionExpectation, OpaqueAggregateHead } from './ports.js';
import type { EncryptedOperation, SignedKeyRoster } from './public-envelopes.js';
import type { StorageMigrationPlan } from './finance-engine.js';

export interface IdSourcePort { next(): UUID }
export interface ClockPort { now(): UtcTimestamp }
export type StoragePersistenceOutcome = {readonly supported:false;readonly status:'unsupported'}|{readonly supported:true;readonly status:'granted'|'denied'|'error'};
export interface StoragePersistencePort {request():Promise<StoragePersistenceOutcome>}
export interface CancellationPort { isCancelled(): boolean; onCancel(handler: () => void): () => void }
export interface BackgroundExecutionPort<TInput, TOutput> { execute(input: TInput, cancellation: CancellationPort): Promise<TOutput> }
export interface ProfileCoordinationPort { withExclusive<T>(profileId: UUID, action: () => Promise<T>): Promise<T> }
export type ProfileLoadOutcome<TProfile> = { readonly kind: 'missing' } | { readonly kind: 'loaded'; readonly profile: TProfile } | { readonly kind: 'corrupt' } | { readonly kind: 'unreadable' };
/** Callback unter exklusiver Profilkoordination und CAS; Fehler dürfen keinen Neuanlagefallback auslösen. */
export interface ProfileStorePort<TProfile> { load(): Promise<ProfileLoadOutcome<TProfile>>; change(update: (current: TProfile | undefined) => Promise<TProfile>): Promise<TProfile> }
export interface LocalFinancialStoragePort<TAggregate, TQuery, TConfirmed, TPending, TSyncPage, TSnapshot, TProjection, TSyncState> extends StorageAdapter<TAggregate, TQuery, TConfirmed, TPending, TSyncPage, TSnapshot, TProjection> {
  readonly profileId: UUID;
  initializeArea(spaceId: UUID, proposedEpoch: UUID): Promise<UUID>;
  getSyncState(spaceId: UUID): Promise<TSyncState | undefined>;
  applyAtomicBatch(batch: AtomicBatch<TAggregate, TPending, TProjection>): Promise<void>;
}
export interface SnapshotProtectionPort<TSnapshot> { seal(snapshot: TSnapshot): Promise<Uint8Array>; unseal(bytes: Uint8Array): Promise<TSnapshot> }
export interface EncryptedBackupReceipt { readonly backupId: UUID; readonly profileId: UUID; readonly spaceId: UUID; readonly epoch: UUID; readonly snapshotHash: Base64Url }
export interface EncryptedBackupPort { persist(input: { readonly profileId: UUID; readonly spaceId: UUID; readonly epoch: UUID; readonly snapshotHash: Base64Url; readonly ciphertext: Uint8Array }): Promise<EncryptedBackupReceipt> }
/** Nur registrierte nummerierte Schritte, atomarer Ausgangsstandsvergleich; keine SQL-Callbacks. */
export interface LocalMigrationPort<TSnapshot> { migrate(input: { readonly plan: StorageMigrationPlan; readonly expectedSnapshot: TSnapshot; readonly backup: EncryptedBackupReceipt | undefined }, cancellation: CancellationPort): Promise<void> }
export type PersistenceErrorCode = 'REVISION_CONFLICT' | 'QUOTA' | 'WRITE_FAILED' | 'UPDATE_REQUIRED' | 'EPOCH_MISMATCH' | 'OPERATION_ID_REUSED';
export type CommitOutcome<T> = { readonly status: 'committed'; readonly value: T } | { readonly status: 'notCommitted'; readonly code: PersistenceErrorCode } | { readonly status: 'unknown'; readonly operationId: UUID };

export interface ServerOperationKey { readonly spaceId: UUID; readonly epoch: UUID; readonly operationId: UUID }
export interface OperationReceiptRecord { readonly key: ServerOperationKey; readonly contentHash: Base64Url; readonly cursor: string }
export interface EncryptedSnapshotRecord { readonly spaceId: UUID; readonly epoch: UUID; readonly cursor: string; readonly ciphertextHash: Base64Url; readonly bytes: Uint8Array }
export interface EncryptedChangeRecord { readonly cursor: string; readonly operation: EncryptedOperation }
export interface PublicIdentityRecord { readonly identityId: UUID; readonly revision: Revision; readonly issuer: string; readonly subject: string }
/** Öffentliche Identität/Roster und Chiffrate teilen genau denselben Transaktionsabschluss. */
export interface ServerPersistenceTransaction {
  readonly ciphertext: {
    readHead(spaceId: UUID, handle: UUID): Promise<OpaqueAggregateHead | undefined>;
    lookupReceipt(key: ServerOperationKey): Promise<OperationReceiptRecord | undefined>;
    writeOperation(input: { readonly operation: EncryptedOperation; readonly expectedRevisions: readonly RevisionExpectation[]; readonly contentHash: Base64Url }): Promise<OperationReceiptRecord>;
    readSnapshot(input: { readonly spaceId: UUID; readonly epoch: UUID }): Promise<EncryptedSnapshotRecord | undefined>;
    replaceSnapshot(input: { readonly expectedEpoch: UUID; readonly expectedCursor: string; readonly snapshot: EncryptedSnapshotRecord }): Promise<void>;
    readChanges(input: { readonly spaceId: UUID; readonly epoch: UUID; readonly afterCursor: string; readonly limit: number }): Promise<readonly EncryptedChangeRecord[]>;
  };
  readonly administration: {
    readIdentity(identityId: UUID): Promise<PublicIdentityRecord | undefined>;
    writeIdentity(input: { readonly expectedRevision: Revision; readonly record: PublicIdentityRecord }): Promise<void>;
    readRoster(spaceId: UUID): Promise<SignedKeyRoster | undefined>;
    writeRoster(input: { readonly expectedRosterHash: Base64Url | undefined; readonly roster: SignedKeyRoster }): Promise<void>;
  };
}
export interface ServerPersistencePort {
  runAtomic<T>(operationId: UUID, action: (transaction: ServerPersistenceTransaction) => Promise<T>): Promise<CommitOutcome<T>>;
}
/** Profilrevision und Finanzrevision sind getrennte CAS-Dimensionen. */
export interface ApplicationScope { readonly profileId: UUID; readonly spaceId: UUID; readonly profileRevision: Revision; readonly sessionGeneration: Revision }
