// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '../../../packages/contracts/src/index.js';
import { DomainValidationError, mergePayees, saveTransaction, type P2Aggregate, type AccountAggregate, type TransactionAggregate, type PayeeAggregate } from '../../../packages/domain/src/index.js';
import { LocalAreaService, StorageRevisionConflictError, toStoredAggregate, type LocalSnapshot, type StoredAggregate } from '../../../packages/storage/src/index.js';
import { id, profileId, spaceId, epoch, equal, normalized } from './snapshot-catalog.js';
import type { RebuildFixture } from './rebuild-catalog.js';
const now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
const check = (value: boolean, message: string) => { if (!value) throw new Error(message); };
export const mergeCases = ['vollständig', 'ausgelassen', 'abgeglichen-ausgelassen', 'doppelt', 'fremd', 'veraltet', 'cas-konflikt', 'schreibrollback'] as const;
export type MergeCase = typeof mergeCases[number];
export async function runMergeCase(scenario: MergeCase, fixture: RebuildFixture): Promise<void> {
  const storage = fixture.storage;
  const account: AccountAggregate = { ...meta(110), aggregateType: 'account', name: 'Testkonto', type: 'checking', onBudget: true, archived: false };
  const group = { ...meta(111), aggregateType: 'categoryGroup' as const, name: 'Testgruppe', kind: 'expense' as const, sortOrder: 0, archived: false };
  const category = { ...meta(112), aggregateType: 'category' as const, name: 'Testkategorie', groupId: group.id, sortOrder: 0, archived: false };
  const source: PayeeAggregate = { ...meta(113), aggregateType: 'payee', name: 'Quelle', aliases: ['Quellalias'], archived: false };
  const target: PayeeAggregate = { ...meta(114), aggregateType: 'payee', name: 'Ziel', aliases: ['Zielalias'], archived: false };
  const transaction: TransactionAggregate = { ...meta(115), aggregateType: 'transaction', accountId: account.id, date: '2026-10-08', amount: -100, kind: 'normal', clearance: scenario === 'abgeglichen-ausgelassen' ? 'reconciled' : 'cleared', payeeId: source.id, note: 'Historische Testbuchung', splits: [{ id: id(116), categoryId: category.id, amount: -100 }] };
  const deleted: TransactionAggregate = { ...transaction, ...meta(117), clearance: 'cleared', deletedAt: now };
  const initial: P2Aggregate[] = [account, group, category, source, target, transaction, deleted, { ...meta(2), aggregateType: 'financialRevision' }];
  if (transaction.clearance === 'reconciled') initial.push({ ...meta(118), aggregateType: 'reconciliation', accountId: account.id, statementDate: transaction.date, statementBalance: -100, transactionIds: [transaction.id] } as P2Aggregate);
  const projections = [{ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: -100 } }, { spaceId, kind: 'balance', key: account.id, payload: -100 }];
  const snapshot: LocalSnapshot = { storageSchemaVersion: fixture.storageSchemaVersion ?? 1, domainSchemaVersion: 1, profileId, spaceId, epoch, aggregates: initial.map(toStoredAggregate), confirmed: [], pending: [{ operationId: id(160), spaceId, expectedRevisions: [], dependsOn: [], state: 'blocked', draft: { originalInput: 'Originalentwurf' }, retryCount: 1 }], projections, syncState: { profileId, spaceId, epoch, cursor: '5' } };
  const service = new LocalAreaService(storage, spaceId, { connected: true });
  let counter = 200;
  const dependencies = { ids: { next: () => id(counter++) }, clock: { now: () => now } };
  try {
    await storage.replaceSnapshot(snapshot);
    const current = await storage.query({ spaceId });
    const heads = { get: (handle: UUID) => current.find((entry) => entry.id === handle), list: () => current };
    const supplied = scenario === 'ausgelassen' || scenario === 'abgeglichen-ausgelassen' ? [] : scenario === 'doppelt' ? [transaction, transaction] : scenario === 'fremd' ? [{ ...transaction, spaceId: id(99) }] : scenario === 'veraltet' ? [{ ...transaction, revision: 2 }] : [transaction];
    let before = normalized(await storage.exportSnapshot(spaceId));
    let rejected: unknown;
    try {
      const change = mergePayees({ spaceId, target, sources: [source], transactions: supplied }, heads, dependencies);
      if (scenario === 'cas-konflikt') {
        const concurrent = { ...transaction, id: id(151), splits: [{ ...transaction.splits[0]!, id: id(152) }] };
        const proposed = saveTransaction({ commandType: 'transaction.save', spaceId, expectedRevisions: [{ id: concurrent.id, expectedRevision: 0 }, ...[account, category, source].map((entry) => ({ id: entry.id, expectedRevision: entry.revision }))], mutations: [{ aggregate: concurrent }] }, heads, dependencies);
        await service.applyChangeSet(proposed, projections.map((entry) => ({ ...entry, payload: entry.kind === 'balance' ? -200 : { balance: -200 } })));
        before = normalized(await storage.exportSnapshot(spaceId));
      }
      const commit = () => service.applyChangeSet(change, projections);
      if (scenario === 'schreibrollback') await fixture.withProjectionWriteFailure(commit); else await commit();
    } catch (error) { rejected = error; }
    const after = normalized(await storage.exportSnapshot(spaceId));
    if (scenario === 'vollständig') {
      check(rejected === undefined, 'Vollständiger Merge wurde abgewiesen.');
      const actual = after.aggregates.find((entry) => entry.id === transaction.id);
      check(equal(actual, toStoredAggregate({ ...transaction, payeeId: target.id, revision: 2 })), 'Merge verändert Buchungsfelder außer Empfänger und Revision.');
      check((after.aggregates.find((entry) => entry.id === source.id) as StoredAggregate & PayeeAggregate).archived, 'Merge archiviert Quelle nicht.');
      check(equal(after.aggregates.find((entry) => entry.id === deleted.id), toStoredAggregate(deleted)), 'Merge überschreibt historische Tombstonereferenz.');
      check(equal(after.projections, before.projections) && equal(after.syncState, before.syncState), 'Merge verändert Finanzcaches oder Cursor.');
      const restarted = await fixture.restart();
      check(equal(after, normalized(await restarted.exportSnapshot(spaceId))), 'Vollständiger Merge übersteht Dateineustart nicht.');
    } else {
      check(rejected !== undefined, 'Ungültiger oder abgebrochener Merge meldet Erfolg.');
      if (!['cas-konflikt', 'schreibrollback'].includes(scenario)) {
        const expectedCode = scenario === 'doppelt' ? 'DUPLICATE_REFERENCE' : scenario === 'veraltet' ? 'REVISION_CONFLICT' : 'INVALID_COMMAND';
        check(rejected instanceof DomainValidationError && rejected.code === expectedCode, 'Fachliche Ablehnung liefert nicht den erwarteten strukturierten Fehler.');
      }
      if (scenario === 'cas-konflikt') check(rejected instanceof StorageRevisionConflictError, 'Stale Merge ist kein strukturierter CAS-Konflikt.');
      check(equal(before, after), 'Merge verändert bei Ablehnung Aggregate, Outbox, Cache oder Cursor teilweise.');
      const restarted = await fixture.restart();
      check(equal(before, normalized(await restarted.exportSnapshot(spaceId))), 'Ablehnung/Rollback erhält dauerhaften Originalbestand nicht.');
    }
  } finally { await fixture.close(); }
}
