// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AtomicBatch } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';

import type { PendingOperation, StoredAggregate, StoredProjection } from './contracts.js';

/** Begrenzter Desktopport; sein Rust-Gegenstück akzeptiert keine SQL- oder Pfadkommandos. */
export interface DesktopStorageBridge {
  applyBatch(input: {
    readonly profileId: UUID;
    readonly expectedRevisions: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>['expectedRevisions'];
    readonly aggregates: readonly StoredAggregate[];
    readonly outbox: readonly PendingOperation[];
    readonly projections: readonly StoredProjection[];
  }): Promise<void>;
  readAggregate(profileId: UUID, handle: UUID): Promise<StoredAggregate | undefined>;
  queryAggregates(profileId: UUID, spaceId: UUID): Promise<readonly StoredAggregate[]>;
}

/** Adapter für Tauri invoke; die Aufrufer sehen nur den katalogisierten Speicherumfang. */
export function createTauriStorageBridge(
  invoke: <T>(command: 'storage_apply_batch' | 'storage_read_aggregate' | 'storage_query_aggregates', arguments_: Record<string, unknown>) => Promise<T>
): DesktopStorageBridge {
  return {
    async applyBatch(input) {
      await invoke<void>('storage_apply_batch', { batch: input });
    },
    async readAggregate(profileId, handle) {
      return invoke<StoredAggregate | undefined>('storage_read_aggregate', { profileId, handle });
    },
    async queryAggregates(profileId, spaceId) {
      return invoke<readonly StoredAggregate[]>('storage_query_aggregates', { profileId, spaceId });
    }
  };
}
