// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { UUID } from '@wimm/contracts';
import type { P2Aggregate } from './commands.js';
import { validateFinancialReferences } from './financial-references.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId: id(1), revision: 1, createdAt: now, updatedAt: now });
const account = { ...meta(2), aggregateType: 'account' as const, archived: false };
const group = { ...meta(3), aggregateType: 'categoryGroup' as const };
const category = { ...meta(4), aggregateType: 'category' as const, groupId: group.id };
const payee = { ...meta(5), aggregateType: 'payee' as const, archived: false };
const transfer = { ...meta(6), aggregateType: 'transfer' as const, sourceAccountId: account.id, targetAccountId: id(9), sourceTransactionId: id(7), targetTransactionId: id(8) };
const transaction = { ...meta(7), aggregateType: 'transaction' as const, accountId: account.id, payeeId: payee.id, transferId: transfer.id, splits: [{ id: id(10), categoryId: category.id }] };
const current: readonly P2Aggregate[] = [account, group, category, payee, transfer];

describe('Neue Finanzreferenzen und historische Tombstones', () => {
  it.each([account, group, category, payee, transfer])('weist ein gelöschtes Ziel ab: $aggregateType', (deleted) => {
    const state = current.map((entry) => entry.id === deleted.id ? { ...entry, deletedAt: now } : entry);
    expect(() => validateFinancialReferences([transaction], state)).toThrow('nicht gelöschtes Ziel');
    expect(state.find((entry) => entry.id === deleted.id)?.deletedAt).toBe(now);
  });
  it('erhält vorhandene historische Referenzen, während neue Splits und Referenzwechsel abgewiesen werden', () => {
    const state = [...current.map((entry) => ({ ...entry, deletedAt: now })), transaction];
    const newSplit = { ...transaction, revision: 2, splits: [{ id: id(11), categoryId: category.id }] };
    const moved = { ...transaction, revision: 2, accountId: id(99) };
    expect(() => validateFinancialReferences([{ ...transaction, revision: 2 }], state)).not.toThrow();
    expect(() => validateFinancialReferences([newSplit], state)).toThrow('nicht gelöschtes Ziel');
    expect(() => validateFinancialReferences([moved], state)).toThrow('nicht gelöschtes Ziel');
  });
  it('erlaubt Archivierung und prüft Bereich und Typ neuer Ziele', () => {
    expect(() => validateFinancialReferences([transaction], current.map((entry) => ({ ...entry, archived: true })))).not.toThrow();
    expect(() => validateFinancialReferences([transaction], current.map((entry) => entry.id === account.id ? { ...entry, spaceId: id(99) } : entry))).toThrow('selben Bereich');
    expect(() => validateFinancialReferences([transaction], current.map((entry) => entry.id === account.id ? { ...entry, aggregateType: 'payee' } : entry))).toThrow('selben Bereich');
  });
  it('prüft neue Kategoriegruppen sowie vollständige Transferziele', () => {
    expect(() => validateFinancialReferences([category], [{ ...group, deletedAt: now }])).toThrow('nicht gelöschtes Ziel');
    const state = [...current, transaction, { ...transaction, id: id(8) }, { ...account, id: id(9) }];
    expect(() => validateFinancialReferences([transfer], state.filter((entry) => entry.id !== transfer.id))).not.toThrow();
    expect(() => validateFinancialReferences([transfer], state.filter((entry) => entry.id !== transfer.id).map((entry) => entry.id === id(8) ? { ...entry, deletedAt: now } : entry))).toThrow('nicht gelöschtes Ziel');
  });
});
