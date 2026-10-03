// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { IndexedDbStorageAdapter, StorageRevisionConflictError, toStoredAggregate } from './index.js';

const profileId = '00000000-0000-4000-8000-000000000101' as const;
const spaceId = '00000000-0000-4000-8000-000000000102' as const;
const accountId = '00000000-0000-4000-8000-000000000103' as const;

function aggregate(revision = 1) {
  return toStoredAggregate({
    id: accountId, spaceId, aggregateType: 'account', revision,
    createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z',
    name: 'Bar', type: 'cash', onBudget: true, archived: false
  });
}

describe('IndexedDbStorageAdapter', () => {
  const adapters: IndexedDbStorageAdapter[] = [];
  afterEach(async () => { await Promise.all(adapters.map((adapter) => adapter.close())); adapters.length = 0; });

  it('bewahrt einen atomaren Batch über einen Adapterneustart', async () => {
    const name = `wimm-test-${crypto.randomUUID()}`;
    const first = new IndexedDbStorageAdapter(profileId, name); adapters.push(first);
    await first.applyAtomicBatch({
      expectedRevisions: [{ handle: accountId, expectedRevision: 0 }], aggregates: [aggregate()], outbox: [],
      projections: [{ spaceId, kind: 'balance', key: accountId, payload: 0 }]
    });
    await first.close();
    const restarted = new IndexedDbStorageAdapter(profileId, name); adapters.push(restarted);
    expect(await restarted.readAggregate(accountId)).toMatchObject({ name: 'Bar', revision: 1 });
    await expect(restarted.applyAtomicBatch({ expectedRevisions: [{ handle: accountId, expectedRevision: 0 }], aggregates: [aggregate(2)], outbox: [], projections: [] }))
      .rejects.toBeInstanceOf(StorageRevisionConflictError);
  });

  it('trennt Profile bei gleichem Bereich', async () => {
    const name = `wimm-test-${crypto.randomUUID()}`;
    const first = new IndexedDbStorageAdapter(profileId, name); adapters.push(first);
    const other = new IndexedDbStorageAdapter('00000000-0000-4000-8000-000000000104', name); adapters.push(other);
    await first.applyAtomicBatch({ expectedRevisions: [{ handle: accountId, expectedRevision: 0 }], aggregates: [aggregate()], outbox: [], projections: [] });
    expect(await other.query({ spaceId })).toEqual([]);
  });
});
