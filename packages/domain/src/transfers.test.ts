// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { Money, UUID } from '@wimm/contracts';

import {
  confirmReconciliation,
  deleteTransfer,
  DomainValidationError,
  saveTransfer,
  unlockReconciliation,
  type AccountAggregate,
  type CategoryAggregate,
  type CategoryGroupAggregate,
  type AggregateHead,
  type AggregateHeadReader,
  type DomainDependencies,
  type ReconciliationAggregate,
  type TransactionAggregate,
  type TransferAggregate
} from './index.js';

const SPACE = '00000000-0000-4000-8000-000000000001' as UUID;
const SOURCE_ACCOUNT = '00000000-0000-4000-8000-000000000011' as UUID;
const TARGET_ACCOUNT = '00000000-0000-4000-8000-000000000012' as UUID;
const CATEGORY = '00000000-0000-4000-8000-000000000013' as UUID;
const GROUP = '00000000-0000-4000-8000-000000000020' as UUID;
const TRANSFER = '00000000-0000-4000-8000-000000000014' as UUID;
const SOURCE_TRANSACTION = '00000000-0000-4000-8000-000000000015' as UUID;
const TARGET_TRANSACTION = '00000000-0000-4000-8000-000000000016' as UUID;
const RECONCILIATION = '00000000-0000-4000-8000-000000000017' as UUID;
const NORMAL_TRANSACTION = '00000000-0000-4000-8000-000000000018' as UUID;
const SPLIT = '00000000-0000-4000-8000-000000000019' as UUID;
const OPERATION = '00000000-0000-4000-8000-000000000101' as UUID;
const NOW = '2026-10-03T12:00:00Z';

function dependencies(): DomainDependencies {
  return { ids: { next: () => OPERATION }, clock: { now: () => NOW } };
}

function head(id: UUID, revision: number, aggregateType: AggregateHead['aggregateType']): AggregateHead {
  return { id, revision, aggregateType, spaceId: SPACE };
}

function reader(...heads: readonly AggregateHead[]): AggregateHeadReader {
  const entries = new Map(heads.map((item) => [item.id, item]));
  return { get: (id) => entries.get(id) ?? (id === '00000000-0000-4000-8000-000000000999' ? { id, spaceId: SPACE, revision: 1, aggregateType: 'categoryGroup' as const } : undefined), list: () => [
    ...heads.filter(h => h.aggregateType === 'account').map(h => ({ ...h, createdAt: NOW, updatedAt: NOW })),
    ...heads.filter(h => h.aggregateType === 'category').map(h => ({ ...h, createdAt: NOW, updatedAt: NOW, groupId: '00000000-0000-4000-8000-000000000999' })),
    { id: '00000000-0000-4000-8000-000000000999', spaceId: SPACE, revision: 1, createdAt: NOW, updatedAt: NOW, aggregateType: 'categoryGroup', kind: 'expense' }
  ] };
}

function account(id: UUID, onBudget: boolean): AccountAggregate {
  return {
    id,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'account',
    name: 'Konto',
    type: 'checking',
    onBudget,
    archived: false
  };
}

function transfer(overrides: Partial<TransferAggregate> = {}): TransferAggregate {
  return {
    id: TRANSFER,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'transfer',
    date: '2026-10-03',
    sourceAccountId: SOURCE_ACCOUNT,
    targetAccountId: TARGET_ACCOUNT,
    sourceTransactionId: SOURCE_TRANSACTION,
    targetTransactionId: TARGET_TRANSACTION,
    amount: 20_000 as Money,
    ...overrides
  };
}

function transferTransaction(
  id: UUID,
  accountId: UUID,
  amount: Money,
  overrides: Partial<TransactionAggregate> = {}
): TransactionAggregate {
  return {
    id,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'transaction',
    accountId,
    date: '2026-10-03',
    amount,
    kind: 'transfer',
    clearance: 'cleared',
    transferId: TRANSFER,
    splits: [],
    ...overrides
  };
}

function normalTransaction(clearance: TransactionAggregate['clearance'] = 'cleared'): TransactionAggregate {
  return {
    id: NORMAL_TRANSACTION,
    spaceId: SPACE,
    revision: clearance === 'reconciled' ? 2 : 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'transaction',
    accountId: SOURCE_ACCOUNT,
    date: '2026-10-03',
    amount: -20_000 as Money,
    kind: 'normal',
    clearance,
    splits: [{ id: SPLIT, categoryId: CATEGORY, amount: -20_000 as Money }]
  };
}

function reconciliation(overrides: Partial<ReconciliationAggregate> = {}): ReconciliationAggregate {
  return {
    id: RECONCILIATION,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'reconciliation',
    accountId: SOURCE_ACCOUNT,
    statementDate: '2026-10-03',
    statementBalance: 50_000 as Money,
    transactionIds: [NORMAL_TRANSACTION],
    ...overrides
  };
}

function expectDomainError(action: () => unknown, code: DomainValidationError['code']): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DomainValidationError);
  expect(caught).toMatchObject({ code });
}

describe('Umbuchungen und Kontenabgleich', () => {
  it('speichert beide Transferseiten samt Budgetgrenzkategorie atomar', () => {
    const result = saveTransfer(
      {
        spaceId: SPACE,
        budgetCategory: { ...account(CATEGORY, true), aggregateType: 'category', groupId: GROUP, sortOrder: 0 } as unknown as CategoryAggregate,
        budgetGroup: { ...account(GROUP, true), aggregateType: 'categoryGroup', kind: 'expense', sortOrder: 0 } as unknown as CategoryGroupAggregate,
        transfer: transfer({ budgetCategoryId: CATEGORY }),
        source: transferTransaction(SOURCE_TRANSACTION, SOURCE_ACCOUNT, -20_000 as Money),
        target: transferTransaction(TARGET_TRANSACTION, TARGET_ACCOUNT, 20_000 as Money),
        sourceAccount: account(SOURCE_ACCOUNT, true),
        targetAccount: account(TARGET_ACCOUNT, false)
      },
      reader(head(SOURCE_ACCOUNT, 1, 'account'), head(TARGET_ACCOUNT, 1, 'account'), head(CATEGORY, 1, 'category'), head(GROUP, 1, 'categoryGroup')),
      dependencies()
    );
    expect(result.aggregates).toHaveLength(6);
    expect(result.aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: TRANSFER }),
        expect.objectContaining({ id: SOURCE_TRANSACTION, amount: -20_000 }),
        expect.objectContaining({ id: TARGET_TRANSACTION, amount: 20_000 })
      ])
    );
  });

  it('weist fehlende Budgetgrenzkategorie vollständig ab', () => {
    expectDomainError(
      () =>
        saveTransfer(
          {
            spaceId: SPACE,
            transfer: transfer(),
            source: transferTransaction(SOURCE_TRANSACTION, SOURCE_ACCOUNT, -20_000 as Money),
            target: transferTransaction(TARGET_TRANSACTION, TARGET_ACCOUNT, 20_000 as Money),
            sourceAccount: account(SOURCE_ACCOUNT, true),
            targetAccount: account(TARGET_ACCOUNT, false)
          },
          reader(head(SOURCE_ACCOUNT, 1, 'account'), head(TARGET_ACCOUNT, 1, 'account')),
          dependencies()
        ),
      'INVALID_AGGREGATE'
    );
  });

  it('löscht Transfer und Gegenbuchungen gemeinsam', () => {
    const deleted = deleteTransfer(
      {
        spaceId: SPACE,
        budgetCategory: { ...account(CATEGORY, true), aggregateType: 'category', groupId: GROUP, sortOrder: 0 } as unknown as CategoryAggregate,
        budgetGroup: { ...account(GROUP, true), aggregateType: 'categoryGroup', kind: 'expense', sortOrder: 0 } as unknown as CategoryGroupAggregate,
        transfer: transfer({ budgetCategoryId: CATEGORY }),
        source: transferTransaction(SOURCE_TRANSACTION, SOURCE_ACCOUNT, -20_000 as Money),
        target: transferTransaction(TARGET_TRANSACTION, TARGET_ACCOUNT, 20_000 as Money),
        sourceAccount: account(SOURCE_ACCOUNT, true),
        targetAccount: account(TARGET_ACCOUNT, false)
      },
      reader(
        head(TRANSFER, 1, 'transfer'),
        head(SOURCE_TRANSACTION, 1, 'transaction'),
        head(TARGET_TRANSACTION, 1, 'transaction'),
        head(SOURCE_ACCOUNT, 1, 'account'),
        head(TARGET_ACCOUNT, 1, 'account'),
        head(CATEGORY, 1, 'category'), head(GROUP, 1, 'categoryGroup')
      ),
      dependencies()
    );
    expect(deleted.aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: TRANSFER, deletedAt: NOW, revision: 2 }),
        expect.objectContaining({ id: SOURCE_TRANSACTION, deletedAt: NOW, revision: 2 }),
        expect.objectContaining({ id: TARGET_TRANSACTION, deletedAt: NOW, revision: 2 })
      ])
    );
  });

  it('liefert die Auszugsdifferenz ohne Korrekturbuchung und entsperrt atomar', () => {
    const confirmed = confirmReconciliation(
      { spaceId: SPACE, reconciliation: reconciliation({ statementBalance: -20_000 as Money }), transactions: [normalTransaction()] },
      reader(head(SOURCE_ACCOUNT, 1, 'account'), head(NORMAL_TRANSACTION, 1, 'transaction')),
      dependencies()
    );
    expect(confirmed.difference).toBe(0);
    expect(confirmed.changeSet.aggregates).toHaveLength(2);
    expect(confirmed.changeSet.aggregates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: NORMAL_TRANSACTION, clearance: 'reconciled', revision: 2 })])
    );

    const unlocked = unlockReconciliation(
      { spaceId: SPACE, reconciliation: reconciliation(), transactions: [normalTransaction('reconciled')] },
      reader(
        head(SOURCE_ACCOUNT, 1, 'account'),
        head(RECONCILIATION, 1, 'reconciliation'),
        head(NORMAL_TRANSACTION, 2, 'transaction')
      ),
      dependencies()
    );
    expect(unlocked.aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: RECONCILIATION, deletedAt: NOW, revision: 2 }),
        expect.objectContaining({ id: NORMAL_TRANSACTION, clearance: 'cleared', revision: 3 })
      ])
    );
  });

  it('erzwingt den gespeicherten Abgleichsstatus auf beiden Transferseiten', () => {
    const input = {
      spaceId: SPACE,
      transfer: transfer({ revision: 2, budgetRelease: true }),
      source: transferTransaction(SOURCE_TRANSACTION, SOURCE_ACCOUNT, -20_000 as Money, { revision: 2, clearance: 'cleared' }),
      target: transferTransaction(TARGET_TRANSACTION, TARGET_ACCOUNT, 20_000 as Money, { revision: 2, clearance: 'cleared' }),
      sourceAccount: account(SOURCE_ACCOUNT, false),
      targetAccount: account(TARGET_ACCOUNT, true)
    };
    const storedSource = { ...input.source, clearance: 'reconciled' as const };
    const storedTarget = { ...input.target, clearance: 'reconciled' as const };
    const currentHeads = reader(
      head(TRANSFER, 2, 'transfer'), head(SOURCE_TRANSACTION, 2, 'transaction'), head(TARGET_TRANSACTION, 2, 'transaction'),
      head(SOURCE_ACCOUNT, 1, 'account'), head(TARGET_ACCOUNT, 1, 'account')
    );
    const withStored = (transactions: readonly TransactionAggregate[]): AggregateHeadReader => ({
      ...currentHeads,
      list: (spaceId) => [...currentHeads.list!(spaceId), ...transactions]
    });
    expectDomainError(() => saveTransfer(input, withStored([storedSource, storedTarget]), dependencies()), 'INVALID_COMMAND');
    expectDomainError(() => deleteTransfer(input, withStored([storedSource, storedTarget]), dependencies()), 'INVALID_COMMAND');

    const unlocked = saveTransfer({ ...input, transfer: { ...input.transfer, revision: 3 }, source: { ...input.source, revision: 3 }, target: { ...input.target, revision: 3 } }, withStored([input.source, input.target]), dependencies());
    expect(unlocked.aggregates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: SOURCE_TRANSACTION, clearance: 'cleared' }),
      expect.objectContaining({ id: TARGET_TRANSACTION, clearance: 'cleared' })
    ]));
  });
});

describe('P4.4-Vertragsgrenzen', () => {
  const input = () => ({ spaceId: SPACE, transfer: transfer(), source: transferTransaction(SOURCE_TRANSACTION, SOURCE_ACCOUNT, -20_000 as Money), target: transferTransaction(TARGET_TRANSACTION, TARGET_ACCOUNT, 20_000 as Money), sourceAccount: account(SOURCE_ACCOUNT, false), targetAccount: account(TARGET_ACCOUNT, true) });
  it('verlangt die ausdrückliche Geldfreigabe beim Eintritt und verbietet die Abgangskategorie', () => {
    const heads = reader(head(SOURCE_ACCOUNT, 1, 'account'), head(TARGET_ACCOUNT, 1, 'account'));
    expectDomainError(() => saveTransfer(input(), heads, dependencies()), 'INVALID_AGGREGATE');
    expect(saveTransfer({ ...input(), transfer: transfer({ budgetRelease: true }) }, heads, dependencies()).aggregates).toHaveLength(6);
    expectDomainError(() => saveTransfer({ ...input(), transfer: transfer({ budgetRelease: true, budgetCategoryId: CATEGORY }) }, heads, dependencies()), 'INVALID_AGGREGATE');
  });
  it('weist nicht passende Ausgabenkategorie, ungültiges Datum und gesperrte Transferänderung ab', () => {
    const heads = reader(head(SOURCE_ACCOUNT, 1, 'account'), head(TARGET_ACCOUNT, 1, 'account'), head(CATEGORY, 1, 'category'));
    expectDomainError(() => saveTransfer({ ...input(), sourceAccount: account(SOURCE_ACCOUNT, true), targetAccount: account(TARGET_ACCOUNT, false), transfer: transfer({ budgetCategoryId: CATEGORY }) }, heads, dependencies()), 'INVALID_AGGREGATE');
    expectDomainError(() => saveTransfer({ ...input(), transfer: transfer({ date: '2026-02-30', budgetRelease: true }) }, heads, dependencies()), 'INVALID_DATE');
    expectDomainError(() => saveTransfer({ ...input(), transfer: transfer({ budgetRelease: true }), source: { ...input().source, clearance: 'reconciled' } }, heads, dependencies()), 'INVALID_COMMAND');
  });
  it('weist Differenz und doppelte Bestätigung ab, berücksichtigt bestätigte Ausgangsbuchungen mit CAS', () => {
    const heads = reader(head(SOURCE_ACCOUNT, 1, 'account'), head(NORMAL_TRANSACTION, 1, 'transaction'));
    expectDomainError(() => confirmReconciliation({ spaceId: SPACE, reconciliation: reconciliation(), transactions: [normalTransaction()] }, heads, dependencies()), 'INVALID_COMMAND');
    const previous = { ...normalTransaction('reconciled'), id: SOURCE_TRANSACTION, amount: 100_000 as Money, splits: [{ id: SPLIT, categoryId: CATEGORY, amount: 100_000 as Money }] };
    const confirmed = confirmReconciliation({ spaceId: SPACE, reconciliation: reconciliation({ statementBalance: 80_000 as Money }), transactions: [normalTransaction()], previousTransactions: [previous] }, reader(head(SOURCE_ACCOUNT, 1, 'account'), head(NORMAL_TRANSACTION, 1, 'transaction'), head(SOURCE_TRANSACTION, 2, 'transaction')), dependencies());
    expect(confirmed.difference).toBe(0); expect(confirmed.changeSet.expectedRevisions).toContainEqual({ id: SOURCE_TRANSACTION, expectedRevision: 2 });
    expect(confirmed.changeSet.aggregates.map((entry) => entry.id)).not.toContain(SOURCE_TRANSACTION);
    expectDomainError(() => confirmReconciliation({ spaceId: SPACE, reconciliation: reconciliation({ statementBalance: -20_000 as Money }), transactions: [normalTransaction('reconciled')] }, reader(head(SOURCE_ACCOUNT, 1, 'account'), head(NORMAL_TRANSACTION, 2, 'transaction')), dependencies()), 'INVALID_COMMAND');
  });
});
