// SPDX-License-Identifier: AGPL-3.0-or-later
import '../../packages/storage/src/indexeddb-test.fixture.js';
import { describe, expect, it } from 'vitest';
import { createEncryptedJsonSnapshotProtector } from '../../packages/crypto/src/index.js';
import type { LocalSnapshot, LocalStorageAdapter } from '../../packages/storage/src/index.js';
import type { UUID } from '../../packages/contracts/src/index.js';

const { IndexedDbStorageAdapter, LocalAreaService, MemoryStorageAdapter } = await import('../../packages/storage/src/index.js');

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const profileId = id(1), spaceId = id(2), epoch = id(3);
const protector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
const wrongProtector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(8));
const factories: readonly [string, () => LocalStorageAdapter & { close?(): Promise<void> }][] = [
  ['Memory', () => new MemoryStorageAdapter(profileId)],
  ['IndexedDB-Modell', () => new IndexedDbStorageAdapter(profileId, `local-snapshot-${crypto.randomUUID()}`)]
];

describe.each(factories)('Lokaler verschlüsselter Snapshot: %s', (_name, factory) => {
  it('exportiert einen leeren Bereich ohne Syncseite oder Outbox mit stabiler Epoche', async () => {
    const store = factory();
    try {
      const service = new LocalAreaService(store, spaceId, { connected: false, initialEpoch: epoch });
      const exported = await service.exportEncryptedSnapshot(protector);
      expect(await protector.unseal(exported)).toMatchObject({ epoch, aggregates: [], pending: [] });
      expect(await store.getSyncState(spaceId)).toBeUndefined();
      expect(await store.initializeArea(spaceId, id(4))).toBe(epoch);
      const proposals = await Promise.all([store.initializeArea(id(5), id(6)), store.initializeArea(id(5), id(7))]);
      expect(new Set(proposals).size).toBe(1);
    } finally { await store.close?.(); }
  });
  it('bewahrt den vollständigen lokalen Stand beim Roundtrip und falschem Schlüssel', async () => {
    const store = factory();
    try {
      const service = new LocalAreaService(store, spaceId, { connected: false, initialEpoch: epoch });
      const account = { id: id(10), spaceId, aggregateType: 'account' as const, revision: 1, createdAt: '2026-10-08T10:00:00Z', updatedAt: '2026-10-08T10:00:00Z', name: 'Synthetisches Konto', type: 'checking' as const, onBudget: true, archived: false };
      await service.applyChangeSet({ operationId: id(11), occurredAt: account.updatedAt, commandType: 'account.save', spaceId, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], aggregates: [account] }, [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: 0 } }]);
      const before = await store.exportSnapshot(spaceId);
      const bytes = await service.exportEncryptedSnapshot(protector);
      expect(new TextDecoder().decode(bytes)).not.toContain(account.name);
      await expect(service.replaceEncryptedSnapshot(wrongProtector, bytes)).rejects.toThrow(/Snapshot|Tresor|verschlüsselt|Authentifizierung/);
      expect(await store.exportSnapshot(spaceId)).toEqual(before);
      await service.replaceEncryptedSnapshot(protector, bytes);
      expect(await store.exportSnapshot(spaceId)).toEqual(before);
      expect(await store.loadPending(spaceId)).toEqual([]);
      expect(await store.getSyncState(spaceId)).toBeUndefined();
    } finally { await store.close?.(); }
  });
});

it('behält die lokale Epoche nach Adapterneustart im IndexedDB-Modell und übernimmt Legacy-Syncmetadaten', async () => {
  const name = `local-epoch-${crypto.randomUUID()}`;
  const first = new IndexedDbStorageAdapter(profileId, name);
  await first.initializeArea(spaceId, epoch); await first.close();
  const restarted = new IndexedDbStorageAdapter(profileId, name);
  try {
    expect(await restarted.initializeArea(spaceId, id(9))).toBe(epoch);
    await restarted.saveSyncPage({ state: { profileId, spaceId: id(12), epoch: id(13), cursor: '42' }, confirmed: [], removeOperationIds: [], projections: [] });
    expect(await restarted.initializeArea(id(12), id(14))).toBe(id(13));
    expect((await restarted.exportSnapshot(id(12))).syncState?.cursor).toBe('42');
  } finally { await restarted.close(); }
});
