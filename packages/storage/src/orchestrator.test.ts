// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { LocalAreaService, MemoryStorageAdapter, toStoredAggregate, type LocalSnapshot, type SnapshotProtector } from './index.js';

const profileId = '00000000-0000-4000-8000-000000000201' as const;
const spaceId = '00000000-0000-4000-8000-000000000202' as const;
const aggregateId = '00000000-0000-4000-8000-000000000203' as const;
const operationId = '00000000-0000-4000-8000-000000000204' as const;

const changeSet = {
  operationId,
  occurredAt: '2026-10-03T00:00:00.000Z',
  commandType: 'account.save' as const,
  spaceId,
  expectedRevisions: [{ id: aggregateId, expectedRevision: 0 as const }],
  aggregates: [{
    ...toStoredAggregate({ id: aggregateId, spaceId, aggregateType: 'account' as const, revision: 1 as const,
      createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', name: 'Giro', type: 'checking' as const, onBudget: true, archived: false })
  }]
};

describe('LocalAreaService', () => {
  it('legt nur für verbundene Bereiche einen getrennten Entwurf an', async () => {
    const connectedStore = new MemoryStorageAdapter(profileId);
    await new LocalAreaService(connectedStore, spaceId, { connected: true }).applyChangeSet(changeSet);
    expect(await connectedStore.loadPending(spaceId)).toHaveLength(1);

    const standaloneStore = new MemoryStorageAdapter(profileId);
    await new LocalAreaService(standaloneStore, spaceId, { connected: false }).applyChangeSet(changeSet);
    expect(await standaloneStore.loadPending(spaceId)).toHaveLength(0);
  });

  it('exportiert und ersetzt Snapshots ausschließlich durch den Schutzport', async () => {
    const store = new MemoryStorageAdapter(profileId);
    await new LocalAreaService(store, spaceId, { connected: true }).applyChangeSet(changeSet);
    await store.saveSyncPage({ state: { profileId, spaceId, epoch: '00000000-0000-4000-8000-000000000205', cursor: '0' }, confirmed: [], removeOperationIds: [], projections: [] });
    const protector: SnapshotProtector = {
      seal: async (snapshot) => new TextEncoder().encode(JSON.stringify(snapshot)),
      unseal: async (bytes) => JSON.parse(new TextDecoder().decode(bytes)) as LocalSnapshot
    };
    const service = new LocalAreaService(store, spaceId, { connected: true });
    const exported = await service.exportEncryptedSnapshot(protector);
    await service.replaceEncryptedSnapshot(protector, exported);
    expect(await store.readAggregate(aggregateId)).toMatchObject({ name: 'Giro' });
  });
});
