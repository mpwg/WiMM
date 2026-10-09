// SPDX-License-Identifier: AGPL-3.0-or-later
import { StorageFailureError } from '../../../packages/storage/src/index.js';
import type { RebuildFixture } from './rebuild-catalog.js';
import { p5Snapshot, spaceId, epoch, id, normalized, equal } from './snapshot-catalog.js';
export interface VersionFixture extends RebuildFixture {
  withSchemaVersion(kind: 'storage' | 'domain', version: number, action: () => Promise<void>): Promise<void>;
}
export const versionCases = ['storage', 'domain'] as const;
export async function runVersionCase(kind: typeof versionCases[number], fixture: VersionFixture): Promise<void> {
  const storage = fixture.storage;
  try {
    await storage.replaceSnapshot(p5Snapshot());
    const before = normalized(await storage.exportSnapshot(spaceId));
    await fixture.withSchemaVersion(kind, 999, async () => {
      const attempts = [() => storage.initializeArea(spaceId, epoch), () => storage.readAggregate(id(10)), () => storage.query({ spaceId }), () => storage.loadConfirmed(spaceId), () => storage.loadPending(spaceId), () => storage.getSyncState(spaceId), () => storage.exportSnapshot(spaceId), () => storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [], outbox: [], projections: [] }), () => storage.saveSyncPage({ state: before.syncState!, confirmed: [], removeOperationIds: [], projections: [] }), () => storage.replaceSnapshot(before), () => storage.rebuildProjections(spaceId)];
      for (const attempt of attempts) {
        let rejected = false;
        try { await attempt(); } catch (error) { rejected = error instanceof StorageFailureError && error.code === 'UPDATE_REQUIRED' && error.commitState === 'notCommitted'; }
        if (!rejected) throw new Error('Unbekannte Storage-/Fachversion wird nicht kontrolliert abgewiesen.');
      }
    });
    if (!equal(before, normalized(await storage.exportSnapshot(spaceId)))) throw new Error('Versionsabweisung verändert Originaldaten.');
    const restarted = await fixture.restart();
    if (!equal(before, normalized(await restarted.exportSnapshot(spaceId)))) throw new Error('Versionsabweisung verändert dauerhaften Bestand.');
  } finally { await fixture.close(); }
}
