// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AtomicBatch } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';

import { rebuildStoredProjections } from './projection-rebuild.js';
import type { ProjectionRebuild, ConfirmedAggregate, LocalSnapshot, LocalStorageAdapter, PendingOperation, StoredAggregate, StoredProjection, SyncPage, SyncState } from './contracts.js';
import { StorageRevisionConflictError, StorageWriteError } from './contracts.js';
import { decodeStorageFailure } from './storage-failure.js';
import { validateLocalSnapshot } from './snapshot-validation.js';

/** Begrenzter Desktopport; sein Rust-Gegenstück akzeptiert keine SQL- oder Pfadkommandos. */
export interface DesktopStorageBridge {
  initializeArea(profileId: UUID, spaceId: UUID, proposedEpoch: UUID): Promise<UUID>;
  applyBatch(input: {
    readonly profileId: UUID;
    readonly expectedRevisions: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>['expectedRevisions'];
    readonly aggregates: readonly StoredAggregate[];
    readonly outbox: readonly PendingOperation[];
    readonly projections: readonly StoredProjection[];
  }): Promise<void>;
  readAggregate(profileId: UUID, handle: UUID): Promise<StoredAggregate | undefined>;
  queryAggregates(profileId: UUID, spaceId: UUID): Promise<readonly StoredAggregate[]>;
  loadConfirmed(profileId: UUID, spaceId: UUID): Promise<readonly ConfirmedAggregate[]>;
  loadPending(profileId: UUID, spaceId: UUID): Promise<readonly PendingOperation[]>;
  saveSyncPage(profileId: UUID, page: SyncPage): Promise<void>;
  getSyncState(profileId: UUID, spaceId: UUID): Promise<SyncState | undefined>;
  exportSnapshot(profileId: UUID, spaceId: UUID): Promise<LocalSnapshot>;
  replaceSnapshot(profileId: UUID, snapshot: LocalSnapshot): Promise<void>;
  rebuildProjections(profileId: UUID, rebuild: ProjectionRebuild): Promise<void>;
}

export type DesktopStorageCommand = 'storage_initialize_area' | 'storage_apply_batch' | 'storage_read_aggregate' | 'storage_query_aggregates' | 'storage_load_confirmed' | 'storage_load_pending' | 'storage_save_sync_page' | 'storage_get_sync_state' | 'storage_export_snapshot' | 'storage_replace_snapshot' | 'storage_rebuild_projections';

/** Adapter für Tauri invoke; die Aufrufer sehen nur den katalogisierten Speicherumfang. */
export function createTauriStorageBridge(
  invoke: <T>(command: DesktopStorageCommand, arguments_: Record<string, unknown>) => Promise<T>
): DesktopStorageBridge {
  async function call<T>(command: DesktopStorageCommand, arguments_: Record<string, unknown>): Promise<T> {
    try {
      const result = await invoke<T>(command, arguments_);
      if (['storage_apply_batch','storage_save_sync_page','storage_replace_snapshot','storage_rebuild_projections'].includes(command) && result != null) throw { contractVersion: 2, code: 'INVALID_RESPONSE', commitState: 'unknown' };
      return result;
    }
    catch (error) {
      const failure = decodeStorageFailure(error);
      if (failure.code === 'REVISION_CONFLICT' && failure.commitState === 'notCommitted') throw new StorageRevisionConflictError();
      throw failure;
    }
  }
  return {
    initializeArea: (profileId, spaceId, proposedEpoch) => call('storage_initialize_area', { profileId, spaceId, proposedEpoch }),
    async applyBatch(input) {
      await call<void>('storage_apply_batch', { batch: input });
    },
    async readAggregate(profileId, handle) {
      return await call<StoredAggregate | null>('storage_read_aggregate', { profileId, handle }) ?? undefined;
    },
    async queryAggregates(profileId, spaceId) {
      return call<readonly StoredAggregate[]>('storage_query_aggregates', { profileId, spaceId });
    },
    loadConfirmed: (profileId, spaceId) => call('storage_load_confirmed', { profileId, spaceId }),
    loadPending: (profileId, spaceId) => call('storage_load_pending', { profileId, spaceId }),
    saveSyncPage: (profileId, page) => call('storage_save_sync_page', { profileId, page }),
    getSyncState: async (profileId, spaceId) => await call<SyncState | null>('storage_get_sync_state', { profileId, spaceId }) ?? undefined,
    exportSnapshot: async (profileId, spaceId) => {
      const snapshot = await call<LocalSnapshot>('storage_export_snapshot', { profileId, spaceId });
      return { ...snapshot, syncState: snapshot.syncState ?? undefined };
    },
    replaceSnapshot: (profileId, snapshot) => call('storage_replace_snapshot', { profileId, snapshot }),
    rebuildProjections: (profileId, rebuild) => call('storage_rebuild_projections', { profileId, rebuild })
  };
}

/** Die appweit verwaltete SQLite-Verbindung bleibt beim Schließen eines Profilports bestehen. */
export class DesktopStorageAdapter implements LocalStorageAdapter {
  constructor(readonly profileId: UUID, private readonly bridge: DesktopStorageBridge) {}
  initializeArea(spaceId: UUID, proposedEpoch: UUID) { return this.bridge.initializeArea(this.profileId, spaceId, proposedEpoch); }
  readAggregate(handle: UUID) { return this.bridge.readAggregate(this.profileId, handle); }
  query({ spaceId }: { readonly spaceId: UUID }) { return this.bridge.queryAggregates(this.profileId, spaceId); }
  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>) { return this.bridge.applyBatch({ profileId: this.profileId, ...batch }); }
  loadConfirmed(spaceId: UUID) { return this.bridge.loadConfirmed(this.profileId, spaceId); }
  loadPending(spaceId: UUID) { return this.bridge.loadPending(this.profileId, spaceId); }
  async saveSyncPage(page: SyncPage) {
    if (page.state.profileId !== this.profileId) throw new StorageWriteError('Die Syncseite gehört zu einem anderen Profil.');
    return this.bridge.saveSyncPage(this.profileId, page);
  }
  getSyncState(spaceId: UUID) { return this.bridge.getSyncState(this.profileId, spaceId); }
  exportSnapshot(spaceId: UUID) { return this.bridge.exportSnapshot(this.profileId, spaceId); }
  async replaceSnapshot(snapshot: LocalSnapshot) {
    return this.bridge.replaceSnapshot(this.profileId, validateLocalSnapshot(snapshot, this.profileId));
  }
  async rebuildProjections(spaceId: UUID) {
    const snapshot = await this.bridge.exportSnapshot(this.profileId, spaceId);
    const projections = rebuildStoredProjections(snapshot.aggregates, spaceId, snapshot.projections);
    return this.bridge.rebuildProjections(this.profileId, { spaceId, sourceAggregates: snapshot.aggregates, projections });
  }
  async close(): Promise<void> {}
}
