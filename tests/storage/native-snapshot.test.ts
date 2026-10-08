// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { runSnapshotCase, snapshotCases } from './contracts/snapshot-catalog.js';
import { sqliteFixture } from './sqlite-fixture.js';
for (const scenario of snapshotCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: ${scenario}`, async () => {
    await expect(runSnapshotCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { runRebuildCase, rebuildCases } from './contracts/rebuild-catalog.js';
for (const scenario of rebuildCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: ${scenario}`, async () => {
    await expect(runRebuildCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { financeSnapshot } from './contracts/rebuild-catalog.js';
import { id, spaceId, normalized } from './contracts/snapshot-catalog.js';
import type { AccountAggregate } from '../../packages/domain/src/index.js';
import type { StoredAggregate } from '../../packages/storage/src/index.js';
import { StorageRevisionConflictError } from '../../packages/storage/src/index.js';
for (const change of ['neues-Aggregat', 'gleiche-Revision'] as const) {
  it(`SQLite-Neuaufbau weist veralteten vollständigen Lesestand ab: ${change}`, async () => {
    const fixture = await sqliteFixture();
    try {
      await fixture.storage.replaceSnapshot(financeSnapshot());
      const account = financeSnapshot().aggregates.find((entry) => entry.id === id(10))! as StoredAggregate & AccountAggregate;
      const changed = { ...account, ...(change === 'neues-Aggregat' ? { id: id(99), handle: id(99) } : {}), name: 'Konkurrierend geändert' };
      fixture.beforeNextRebuild!((storage) => storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [changed], outbox: [], projections: [] }));
      await expect(fixture.storage.rebuildProjections(spaceId)).rejects.toBeInstanceOf(StorageRevisionConflictError);
      const snapshot = normalized(await fixture.storage.exportSnapshot(spaceId));
      expect(snapshot.projections).toEqual(normalized(financeSnapshot()).projections);
      expect((snapshot.aggregates.find((entry) => entry.id === (change === 'neues-Aggregat' ? id(99) : id(10))) as StoredAggregate & AccountAggregate).name).toBe('Konkurrierend geändert');
    } finally { await fixture.close(); }
  });
}
