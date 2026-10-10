// SPDX-License-Identifier: AGPL-3.0-or-later
import { StorageRevisionConflictError, type LocalStorageAdapter, type StoredAggregate, type StoredProjection, type LocalSnapshot } from '../../../packages/storage/src/index.js';
import { equal, normalized, id, spaceId, epoch, p5Snapshot, type SnapshotFixture } from './snapshot-catalog.js';

export interface RebuildFixture extends SnapshotFixture {
  withProjectionWriteFailure(action: () => Promise<void>): Promise<void>;
  beforeNextRebuild?(action: (storage: LocalStorageAdapter) => Promise<void>): void;
}
function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }
const now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), handle: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
export function financeSnapshot(): LocalSnapshot {
  const p5 = p5Snapshot();
  const base = p5.aggregates.filter((entry) => ['account', 'categoryGroup', 'category', 'payee'].includes(entry.aggregateType));
  const incomeGroup = { ...meta(26), aggregateType: 'categoryGroup' as const, name: 'Einnahmen', kind: 'income' as const, archived: false, sortOrder: 1 };
  const incomeCategory = { ...meta(27), aggregateType: 'category' as const, name: 'Einkommen', groupId: incomeGroup.id, archived: false, sortOrder: 1 };
  const opening = { ...meta(30), aggregateType: 'transaction' as const, accountId: id(10), date: '2026-10-08', amount: 100_000, kind: 'opening' as const, clearance: 'cleared' as const, splits: [] };
  const expense = { ...opening, ...meta(31), kind: 'normal' as const, amount: -10_000, splits: [{ id: id(60), categoryId: id(13), amount: -10_000 }] };
  const income = { ...expense, ...meta(32), amount: 20_000, splits: [{ id: id(61), categoryId: incomeCategory.id, amount: 20_000 }] };
  const refund = { ...expense, ...meta(33), amount: 2_000, splits: [{ id: id(62), categoryId: id(13), amount: 2_000 }] };
  const deleted = { ...expense, ...meta(34), amount: -50_000, splits: [{ id: id(63), categoryId: id(13), amount: -50_000 }], deletedAt: now };
  const transfer = { ...meta(35), aggregateType: 'transfer' as const, date: opening.date, sourceAccountId: id(10), targetAccountId: id(11), sourceTransactionId: id(36), targetTransactionId: id(37), amount: 20_000 };
  const source = { ...opening, ...meta(36), kind: 'transfer' as const, amount: -20_000, transferId: transfer.id };
  const target = { ...source, ...meta(37), accountId: id(11), amount: 20_000 };
  const unused = { ...meta(28), aggregateType: 'account' as const, name: 'Leeres Konto', type: 'cash' as const, onBudget: true, archived: false };
  const aggregates: StoredAggregate[] = [...base, unused, incomeGroup, incomeCategory, opening, expense, income, refund, deleted, transfer, source, target];
  return { ...p5, aggregates, confirmed: [], syncState: undefined, projections: expectedProjections() };
}
export function expectedProjections(adjustment = 0): readonly StoredProjection[] {
  const consumption = { income: 20_000, expense: 8_000, net: 12_000, categories: [{ categoryId: id(13), groupKind: 'expense', amount: -8_000 }, { categoryId: id(27), groupKind: 'income', amount: 20_000 }] };
  return [{ spaceId, kind: 'accountBalance', key: id(28), payload: { balance: 0 } }, { spaceId, kind: 'accountBalance', key: id(10), payload: { balance: 92_000 + adjustment } }, { spaceId, kind: 'accountBalance', key: id(11), payload: { balance: 20_000 } }, { spaceId, kind: 'balance', key: id(10), payload: 92_000 + adjustment }, { spaceId, kind: 'consumption', key: 'all', payload: consumption }, { spaceId, kind: 'consumption', key: '2026-10', payload: consumption }, { spaceId, kind: 'consumption', key: '2026-09', payload: { income: 0, expense: 0, net: 0, categories: [] } }];
}
const projectionValues = (projections: readonly StoredProjection[]) => normalized({ ...financeSnapshot(), projections }).projections;
export const rebuildCases = ['neuaufbau-finanzwerte', 'neuaufbau-schreibrollback', 'neuaufbau-überlauf', 'neuaufbau-konkurrenz'] as const;
export type RebuildCase = typeof rebuildCases[number];
export async function runRebuildCase(scenario: RebuildCase, fixture: RebuildFixture): Promise<void> {
  let storage = fixture.storage;
  const original = financeSnapshot();
  try {
    await storage.replaceSnapshot(original);
    if (scenario === 'neuaufbau-finanzwerte') {
      const foreign = fixture.forProfile(id(96));
      await foreign.replaceSnapshot({ ...original, profileId: id(96) });
      const foreignBefore = normalized(await foreign.exportSnapshot(spaceId));
      const otherSpace = id(98);
      await storage.initializeArea(otherSpace, epoch);
      const other = await storage.exportSnapshot(otherSpace);
      await storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [], outbox: [], projections: [{ spaceId, kind: 'balance', key: id(10), payload: 999 }] });
      await storage.rebuildProjections(spaceId);
      check(equal(projectionValues((await storage.exportSnapshot(spaceId)).projections), projectionValues(original.projections)), 'F01/Transfer/Erstattung/Tombstone/Monatscache muss dem vollständigen inkrementellen Ergebnis entsprechen.');
      check(equal(foreignBefore, normalized(await foreign.exportSnapshot(spaceId))), 'Neuaufbau verändert anderes Profil.');
      check(equal(other, await storage.exportSnapshot(otherSpace)), 'Neuaufbau verändert anderen Bereich.');
      const before = normalized(await storage.exportSnapshot(spaceId));
      await storage.rebuildProjections(spaceId);
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Neuaufbau ist nicht idempotent.');
      await storage.replaceSnapshot({ ...original, projections: [] });
      await storage.rebuildProjections(spaceId);
      const canonical = original.projections.filter((entry) => entry.kind !== 'balance' && entry.key !== '2026-09');
      const afterEmpty = normalized(await storage.exportSnapshot(spaceId));
      check(equal(projectionValues(afterEmpty.projections), projectionValues(canonical)), 'Auch ohne vorhandene Caches müssen alle Saldo-/Konsumwerte entstehen.');
      storage = await fixture.restart();
      check(equal(afterEmpty, normalized(await storage.exportSnapshot(spaceId))), 'Neuaufbau ist nicht dauerhaft.');
      return;
    }
    if (scenario === 'neuaufbau-schreibrollback') {
      const before = normalized(await storage.exportSnapshot(spaceId));
      await fixture.withProjectionWriteFailure(async () => {
        let rejected = false;
        try { await storage.rebuildProjections(spaceId); } catch { rejected = true; }
        check(rejected, 'Schreibfehler nach Cachelöschung darf keinen Erfolg melden.');
      });
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Abbruch nach erster Cachezeile verändert vollständigen Bestand.');
      storage = await fixture.restart();
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Rollback übersteht Neustart nicht.');
      await storage.rebuildProjections(spaceId);
      check(equal(projectionValues((await storage.exportSnapshot(spaceId)).projections), projectionValues(original.projections)), 'Neuaufbau nach Fehler ist nicht wiederholbar.');
      return;
    }
    if (scenario === 'neuaufbau-überlauf') {
      const extra = { ...meta(40), aggregateType: 'transaction' as const, accountId: id(10), date: '2026-10-08', amount: Number.MAX_SAFE_INTEGER, kind: 'opening' as const, clearance: 'cleared' as const, splits: [] };
      await storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [extra], outbox: [], projections: [] });
      const before = normalized(await storage.exportSnapshot(spaceId));
      let rejected = false;
      try { await storage.rebuildProjections(spaceId); } catch { rejected = true; }
      check(rejected && equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Überlauf darf vorherige Caches und Entwürfe nicht löschen.');
      return;
    }
    const opening = original.aggregates.find((entry) => entry.id === id(30))!;
    const changed = { ...opening, revision: 2, amount: 100_001 };
    const results = await Promise.allSettled([
      storage.rebuildProjections(spaceId),
      storage.applyAtomicBatch({ expectedRevisions: [{ handle: opening.handle, expectedRevision: 1 }], aggregates: [changed], outbox: [], projections: expectedProjections(1) })
    ]);
    for (const result of results) if (result.status === 'rejected') check(result.reason instanceof StorageRevisionConflictError, 'Konkurrierender Neuaufbau darf nur kontrollierten CAS-Konflikt liefern.');
    check(results[1]!.status === 'fulfilled', 'Finanzwrite ging verloren.');
    check(equal(projectionValues((await storage.exportSnapshot(spaceId)).projections), projectionValues(expectedProjections(1))), 'Konkurrierender Neuaufbau hinterlässt veraltete Finanzwerte.');
    await storage.rebuildProjections(spaceId);
    check(equal(projectionValues((await storage.exportSnapshot(spaceId)).projections), projectionValues(expectedProjections(1))), 'Frischer Neuaufbau nach Konkurrenz ist falsch.');
  } finally { await fixture.close(); }
}
