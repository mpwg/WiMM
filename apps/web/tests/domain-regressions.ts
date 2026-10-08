// SPDX-License-Identifier: AGPL-3.0-or-later
// Synthetische Vite-Testseite; kein Produktionsentry.
import type { UUID } from '@wimm/contracts';
import { createEncryptedJsonSnapshotProtector } from '@wimm/crypto';
import { DomainValidationError, mergePayees, saveTransaction, type P2Aggregate, type AccountAggregate, type CategoryGroupAggregate, type CategoryAggregate, type PayeeAggregate, type TransactionAggregate } from '@wimm/domain';
import { IndexedDbStorageAdapter, LocalAreaService, StorageRevisionConflictError, toStoredAggregate, type LocalSnapshot } from '@wimm/storage';

type Scenario = 'account' | 'category' | 'categoryGroup' | 'payee' | 'merge-omitted' | 'merge-stale' | 'merge-complete';
declare global { interface Window { domainRegression: (scenario: Scenario) => Promise<{ code: string; unchanged: boolean; transaction?: TransactionAggregate; sourceArchived?: boolean }> } }
declare global { interface Window { localSnapshotRegression: (filled: boolean) => Promise<{ epoch: UUID; stableEpoch: boolean; wrongKeyRejected: boolean; unchanged: boolean; noOutbox: boolean; noSyncState: boolean; encrypted: boolean }> } }
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}` as UUID;
const spaceId = id(1), profileId = id(2), now = '2026-10-08T10:00:00Z';
const meta = (value: number) => ({ id: id(value), spaceId, revision: 1, createdAt: now, updatedAt: now });

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
    return { code, unchanged: JSON.stringify(before) === JSON.stringify(after), transaction: after.aggregates.find((entry) => entry.id === transaction.id) as unknown as TransactionAggregate, sourceArchived: (after.aggregates.find((entry) => entry.id === source.id) as unknown as PayeeAggregate).archived };
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
    const unchangedAfterWrongKey = JSON.stringify(await storage.exportSnapshot(spaceId)) === JSON.stringify(before);
    await service.replaceEncryptedSnapshot(protector, bytes);
    const unchanged = unchangedAfterWrongKey && JSON.stringify(await storage.exportSnapshot(spaceId)) === JSON.stringify(before);
    await storage.close();
    storage = new IndexedDbStorageAdapter(profileId, name);
    service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: id(96) });
    const restarted = await protector.unseal(await service.exportEncryptedSnapshot(protector));
    return { epoch: before.epoch, stableEpoch: restarted.epoch === before.epoch, wrongKeyRejected, unchanged, noOutbox: restarted.pending.length === 0, noSyncState: restarted.syncState === undefined, encrypted: !new TextDecoder().decode(bytes).includes('Lokales synthetisches Konto') };
  } finally { await storage.close(); }
};
