// SPDX-License-Identifier: AGPL-3.0-or-later
// Synthetische Vite-Testseite; kein Produktionsentry.
import type { UUID } from '@wimm/contracts';
import { canonicalJsonBytes, createEncryptedJsonSnapshotProtector } from '@wimm/crypto';
import { DomainValidationError, mergePayees, saveTransaction, type P2Aggregate, type AccountAggregate, type CategoryGroupAggregate, type CategoryAggregate, type PayeeAggregate, type TransactionAggregate } from '@wimm/domain';
import { IndexedDbStorageAdapter, LocalAreaService, StorageRevisionConflictError, toStoredAggregate, type LocalSnapshot } from '@wimm/storage';

type Scenario = 'account' | 'category' | 'categoryGroup' | 'payee' | 'merge-omitted' | 'merge-stale' | 'merge-complete';
declare global { interface Window { domainRegression: (scenario: Scenario) => Promise<{ code: string; unchanged: boolean; transaction?: TransactionAggregate; sourceArchived?: boolean }> } }
declare global { interface Window { localSnapshotRegression: (filled: boolean) => Promise<{ epoch: UUID; stableEpoch: boolean; wrongKeyRejected: boolean; unchanged: boolean; noOutbox: boolean; noSyncState: boolean; encrypted: boolean }> } }
declare global { interface Window { snapshotConsistencyRegression: () => Promise<boolean> } }
declare global { interface Window { snapshotValidationRegression: () => Promise<boolean> } }
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}` as UUID;
const spaceId = id(1), profileId = id(2), now = '2026-10-08T10:00:00Z';
const meta = (value: number) => ({ id: id(value), spaceId, revision: 1, createdAt: now, updatedAt: now });
const equal = (left: unknown, right: unknown) => new TextDecoder().decode(canonicalJsonBytes(left)) === new TextDecoder().decode(canonicalJsonBytes(right));

window.domainRegression = async (scenario) => {
  const account: AccountAggregate = { ...meta(3), aggregateType: 'account', name: 'Testkonto', type: 'checking', onBudget: true, archived: false };
  const group: CategoryGroupAggregate = { ...meta(4), aggregateType: 'categoryGroup', name: 'Testgruppe', kind: 'expense', sortOrder: 0, archived: false };
  const category: CategoryAggregate = { ...meta(5), aggregateType: 'category', name: 'Testkategorie', groupId: group.id, sortOrder: 0, archived: false };
  const source: PayeeAggregate = { ...meta(6), aggregateType: 'payee', name: 'Quelle', aliases: [], archived: false };
  const target: PayeeAggregate = { ...meta(7), aggregateType: 'payee', name: 'Ziel', aliases: [], archived: false };
  const transaction: TransactionAggregate = { ...meta(8), aggregateType: 'transaction', accountId: account.id, date: '2026-10-08', amount: -100, kind: 'normal', clearance: 'cleared', payeeId: source.id, note: 'Historische Testbuchung', splits: [{ id: id(9), categoryId: category.id, amount: -100 }] };
  const initial: readonly P2Aggregate[] = [account, group, category, source, target, transaction].map((entry) => entry.aggregateType === scenario ? { ...entry, deletedAt: now } : entry);
  const storage = new IndexedDbStorageAdapter(profileId, `wimm-domain-${scenario}`);
  const service = new LocalAreaService(storage, spaceId, { connected: true });
  const projection = { spaceId, kind: 'accountBalance', key: account.id, payload: { balance: -100 } };
  const dependencies = { ids: { next: () => id(90) }, clock: { now: () => now } };
  try {
    await storage.applyAtomicBatch({ expectedRevisions: [], aggregates: initial.map(toStoredAggregate), outbox: [{ operationId: id(91), spaceId, expectedRevisions: [], dependsOn: [], state: 'queued', draft: { synthetic: true }, retryCount: 0 }], projections: [projection] });
    await storage.saveSyncPage({ state: { profileId, spaceId, epoch: id(92), cursor: '0' }, confirmed: [], removeOperationIds: [], projections: [] });
    const current = await storage.query({ spaceId });
    const heads = { get: (handle: UUID) => current.find((entry) => entry.id === handle), list: () => current };
    let before = await storage.exportSnapshot(spaceId);
    let code = 'OK';
    try {
      if (scenario.startsWith('merge')) {
        const change = mergePayees({ spaceId, target, sources: [source], transactions: scenario === 'merge-omitted' ? [] : [transaction] }, heads, dependencies);
        if (scenario === 'merge-stale') {
          const concurrent = { ...transaction, id: id(50), note: 'Gleichzeitige Quellbuchung', splits: [{ ...transaction.splits[0]!, id: id(51) }] };
          await service.applyChangeSet(saveTransaction({ commandType: 'transaction.save', spaceId, expectedRevisions: [{ id: concurrent.id, expectedRevision: 0 }, ...[account, category, source].map((entry) => ({ id: entry.id, expectedRevision: entry.revision }))], mutations: [{ aggregate: concurrent }] }, heads, dependencies), [projection]);
          before = await storage.exportSnapshot(spaceId);
        }
        await service.applyChangeSet(change, [projection]);
      } else {
        const proposed = { ...transaction, id: id(50), splits: [{ ...transaction.splits[0]!, id: id(51) }] };
        await service.applyChangeSet(saveTransaction({ commandType: 'transaction.save', spaceId, expectedRevisions: [{ id: proposed.id, expectedRevision: 0 }, ...[account, category, source].map((entry) => ({ id: entry.id, expectedRevision: entry.revision }))], mutations: [{ aggregate: proposed }] }, heads, dependencies), [projection]);
      }
    } catch (error) {
      if (error instanceof DomainValidationError) code = error.code;
      else if (error instanceof StorageRevisionConflictError) code = 'STORAGE_REVISION_CONFLICT';
      else throw error;
    }
    const after = await storage.exportSnapshot(spaceId);
    return { code, unchanged: equal(before, after), transaction: after.aggregates.find((entry) => entry.id === transaction.id) as unknown as TransactionAggregate, sourceArchived: (after.aggregates.find((entry) => entry.id === source.id) as unknown as PayeeAggregate).archived };
  } finally { await storage.close(); }
};

window.localSnapshotRegression = async (filled) => {
  const name = `wimm-local-snapshot-${filled}`;
  let storage = new IndexedDbStorageAdapter(profileId, name);
  const protector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  const wrongProtector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(8));
  try {
    let service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: id(95) });
    if (filled) {
      const account: AccountAggregate = { ...meta(3), aggregateType: 'account', name: 'Lokales synthetisches Konto', type: 'checking', onBudget: true, archived: false };
      await service.applyChangeSet({ commandType: 'account.save', spaceId, operationId: id(90), occurredAt: now, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], aggregates: [account] }, [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: 0 } }]);
    }
    const bytes = await service.exportEncryptedSnapshot(protector);
    const before = await storage.exportSnapshot(spaceId);
    let wrongKeyRejected = false;
    try { await service.replaceEncryptedSnapshot(wrongProtector, bytes); } catch { wrongKeyRejected = true; }
    const unchangedAfterWrongKey = equal(await storage.exportSnapshot(spaceId), before);
    await service.replaceEncryptedSnapshot(protector, bytes);
    const unchanged = unchangedAfterWrongKey && equal(await storage.exportSnapshot(spaceId), before);
    await storage.close();
    storage = new IndexedDbStorageAdapter(profileId, name);
    service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: id(96) });
    const restarted = await protector.unseal(await service.exportEncryptedSnapshot(protector));
    return { epoch: before.epoch, stableEpoch: restarted.epoch === before.epoch, wrongKeyRejected, unchanged, noOutbox: restarted.pending.length === 0, noSyncState: restarted.syncState === undefined, encrypted: !new TextDecoder().decode(bytes).includes('Lokales synthetisches Konto') };
  } finally { await storage.close(); }
};

window.snapshotConsistencyRegression = async () => {
  const name = 'wimm-parallel-snapshot';
  const reader = new IndexedDbStorageAdapter(profileId, name), writer = new IndexedDbStorageAdapter(profileId, name);
  try {
    await reader.initializeArea(spaceId, id(95));
    const base = await reader.exportSnapshot(spaceId);
    const snapshot = (cursor: number): LocalSnapshot => {
      const account = toStoredAggregate({ ...meta(3), aggregateType: 'account' as const, revision: cursor + 1, name: `Synthetischer Commit ${cursor}`, type: 'checking' as const, onBudget: true, archived: false });
      const opening = toStoredAggregate({ ...meta(4), aggregateType: 'transaction' as const, revision: cursor + 1, accountId: account.id, date: '2026-10-08', amount: cursor, kind: 'opening' as const, clearance: 'cleared' as const, splits: [] });
      return { ...base, aggregates: [account, opening], confirmed: [account, opening].map((aggregate) => ({ spaceId, epoch: base.epoch, aggregate })), pending: [{ operationId: id(90), spaceId, expectedRevisions: [], dependsOn: [], state: 'queued', draft: { marker: cursor }, retryCount: 0 }], projections: [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: cursor } }], syncState: { profileId, spaceId, epoch: base.epoch, cursor: String(cursor) } };
    };
    await writer.replaceSnapshot(snapshot(0));
    for (let cursor = 1; cursor <= 30; cursor++) {
      const [actual] = await Promise.all([reader.exportSnapshot(spaceId), writer.replaceSnapshot(snapshot(cursor))]);
      const expected = Number(actual.syncState?.cursor);
      const expectedSnapshot = snapshot(expected);
      if (![cursor - 1, cursor].includes(expected) || !equal(actual, expectedSnapshot)) return false;
    }
    return true;
  } finally { await reader.close(); await writer.close(); }
};

window.snapshotValidationRegression = async () => {
  const storage = new IndexedDbStorageAdapter(profileId, 'wimm-invalid-snapshot');
  const service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: id(95) });
  const protector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  try {
    const account: AccountAggregate = { ...meta(3), aggregateType: 'account', name: 'Geschützter synthetischer Bestand', type: 'checking', onBudget: true, archived: false };
    await service.applyChangeSet({ commandType: 'account.save', spaceId, operationId: id(90), occurredAt: now, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], aggregates: [account] }, [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: 0 } }]);
    const before = await storage.exportSnapshot(spaceId);
    const invalid = [
      { ...before, storageSchemaVersion: 999 }, { ...before, domainSchemaVersion: 999 },
      { ...before, aggregates: [{ ...before.aggregates[0]!, spaceId: id(99) }] },
      { ...before, aggregates: [before.aggregates[0]!, before.aggregates[0]!] },
      { ...before, aggregates: [{ ...before.aggregates[0]!, revision: 0 }] },
      { ...before, confirmed: [{ spaceId, epoch: id(99), aggregate: before.aggregates[0]! }] },
      { ...before, projections: [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: 1 } }] },
      { ...before, syncState: { profileId: id(99), spaceId, epoch: before.epoch, cursor: '0' } }
    ];
    for (const value of invalid) {
      const bytes = await protector.seal(value);
      let rejected = false;
      try { await service.replaceEncryptedSnapshot(protector, bytes); } catch { rejected = true; }
      if (!rejected || !equal(before, await storage.exportSnapshot(spaceId))) return false;
    }
    return true;
  } finally { await storage.close(); }
};

// Derselbe Contract-Katalog wie im tatsächlichen Rust-/SQLite-Dateiprozesstest.
import { runSnapshotCase, profileId as contractProfile, type SnapshotCase } from '../../../tests/storage/contracts/snapshot-catalog.js';
declare global { interface Window { storageSnapshotContract: (scenario: SnapshotCase) => Promise<void> } }
window.storageSnapshotContract = async (scenario) => {
  const name = `wimm-snapshot-contract-${crypto.randomUUID()}`;
  let storage = new IndexedDbStorageAdapter(contractProfile, name);
  await runSnapshotCase(scenario, { storage, forProfile: (profile) => new IndexedDbStorageAdapter(profile, name), async restart() { await storage.close(); storage = new IndexedDbStorageAdapter(contractProfile, name); return storage; }, async close() { await storage.close(); } });
};
