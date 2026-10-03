// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { MemoryStorageAdapter, StorageRevisionConflictError, toStoredAggregate } from './index.js';

const profileId = '00000000-0000-4000-8000-000000000001' as const;
const spaceId = '00000000-0000-4000-8000-000000000002' as const;
const epoch = '00000000-0000-4000-8000-000000000003' as const;
const accountId = '00000000-0000-4000-8000-000000000004' as const;
const operationId = '00000000-0000-4000-8000-000000000005' as const;

function account(revision = 1) {
  return toStoredAggregate({
    id: accountId,
    spaceId,
    aggregateType: 'account',
    revision,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    name: 'Giro',
    type: 'checking',
    onBudget: true,
    archived: false
  });
}

describe('MemoryStorageAdapter', () => {
  it('speichert Aggregat, Entwurf und Projektion atomar', async () => {
    const adapter = new MemoryStorageAdapter(profileId);
    await adapter.applyAtomicBatch({
      expectedRevisions: [{ handle: accountId, expectedRevision: 0 }],
      aggregates: [account()],
      outbox: [{ operationId, spaceId, expectedRevisions: [], dependsOn: [], state: 'queued', draft: { command: 'account.save' }, retryCount: 0 }],
      projections: [{ spaceId, kind: 'balance', key: accountId, payload: 0 }]
    });

    expect(await adapter.readAggregate(accountId)).toMatchObject({ revision: 1, name: 'Giro' });
    expect(await adapter.loadPending(spaceId)).toHaveLength(1);

    await expect(adapter.applyAtomicBatch({ expectedRevisions: [{ handle: accountId, expectedRevision: 0 }], aggregates: [account(2)], outbox: [], projections: [] }))
      .rejects.toBeInstanceOf(StorageRevisionConflictError);
    expect(await adapter.readAggregate(accountId)).toMatchObject({ revision: 1 });
  });

  it('committet bestätigte Seite und Cursor gemeinsam', async () => {
    const adapter = new MemoryStorageAdapter(profileId);
    await adapter.applyAtomicBatch({ expectedRevisions: [{ handle: accountId, expectedRevision: 0 }], aggregates: [account()], outbox: [{ operationId, spaceId, expectedRevisions: [], dependsOn: [], state: 'queued', draft: {}, retryCount: 0 }], projections: [] });
    await adapter.saveSyncPage({
      state: { profileId, spaceId, epoch, cursor: '1' },
      confirmed: [{ spaceId, epoch, aggregate: account() }],
      removeOperationIds: [operationId],
      projections: [{ spaceId, kind: 'balance', key: accountId, payload: 0 }]
    });
    expect(await adapter.getSyncState(spaceId)).toMatchObject({ cursor: '1' });
    expect(await adapter.loadConfirmed(spaceId)).toHaveLength(1);
    expect(await adapter.loadPending(spaceId)).toHaveLength(0);
  });
});
