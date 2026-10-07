// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { saveTransaction, projectAccountBalances, type P2Aggregate, type TransactionAggregate } from './index.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const spaceId = id(1); const now = '2026-10-07T12:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
it('prüft dieselbe stabile Summenreihenfolge wie nach dem IndexedDB-Commit', () => {
  const account = { ...meta(2), aggregateType: 'account' as const, name: 'A', type: 'checking', onBudget: true, archived: false };
  const group = { ...meta(3), aggregateType: 'categoryGroup' as const, kind: 'income' };
  const category = { ...meta(4), aggregateType: 'category' as const, groupId: group.id };
  const tx = (n: number, amount: number): TransactionAggregate => ({ ...meta(n), aggregateType: 'transaction', accountId: account.id, date: '2026-10-07', kind: 'normal', clearance: 'uncleared', amount, splits: [{ id: id(n + 100), categoryId: category.id, amount }] });
  const all: P2Aggregate[] = [account, group, category, tx(20, Number.MAX_SAFE_INTEGER), tx(30, -1)];
  const proposed = tx(10, 1);
  expect(() => saveTransaction({ commandType: 'transaction.save', spaceId, expectedRevisions: [{ id: proposed.id, expectedRevision: 0 }, { id: account.id, expectedRevision: 1 }, { id: category.id, expectedRevision: 1 }], mutations: [{ aggregate: proposed }] }, { get: target => all.find(a => a.id === target), list: () => all }, { ids: { next: () => id(900) }, clock: { now: () => now } })).toThrow('Centbereich');
});
it('Kontoprojektionen sind unabhängig von der Speicherreihenfolge', () => {
  const tx = (n: number, amount: number) => ({ ...meta(n), aggregateType: 'transaction', accountId: id(2), amount, deletedAt: undefined }) as unknown as TransactionAggregate;
  const values = [tx(10, 1), tx(20, Number.MAX_SAFE_INTEGER), tx(30, -1)];
  expect(() => projectAccountBalances(values)).toThrow('Centbereich');
  expect(() => projectAccountBalances(values.toReversed())).toThrow('Centbereich');
});
