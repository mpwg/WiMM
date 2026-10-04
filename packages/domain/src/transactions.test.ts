// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { Money, UUID } from '@wimm/contracts';

import {
  deleteTransaction,
  DomainValidationError,
  saveTransaction,
  type AggregateHead,
  type AggregateHeadReader,
  type DomainDependencies,
  type TransactionAggregate
} from './index.js';

const SPACE = '00000000-0000-4000-8000-000000000001' as UUID;
const ACCOUNT = '00000000-0000-4000-8000-000000000011' as UUID;
const CATEGORY = '00000000-0000-4000-8000-000000000012' as UUID;
const PAYEE = '00000000-0000-4000-8000-000000000013' as UUID;
const TRANSACTION = '00000000-0000-4000-8000-000000000014' as UUID;
const SPLIT_ONE = '00000000-0000-4000-8000-000000000015' as UUID;
const SPLIT_TWO = '00000000-0000-4000-8000-000000000016' as UUID;
const OPERATION = '00000000-0000-4000-8000-000000000101' as UUID;
const NOW = '2026-10-03T12:00:00Z';

function dependencies(): DomainDependencies {
  return { ids: { next: () => OPERATION }, clock: { now: () => NOW } };
}

function reader(...heads: readonly AggregateHead[]): AggregateHeadReader {
  const entries = new Map(heads.map((item) => [item.id, item]));
  return { get: (id) => entries.get(id) };
}

function head(id: UUID, revision: number, aggregateType: AggregateHead['aggregateType']): AggregateHead {
  return { id, revision, aggregateType, spaceId: SPACE };
}

function transaction(overrides: Partial<TransactionAggregate> = {}): TransactionAggregate {
  return {
    id: TRANSACTION,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'transaction',
    accountId: ACCOUNT,
    date: '2026-10-03',
    amount: -10_000 as Money,
    kind: 'normal',
    payeeId: PAYEE,
    note: '  Wocheneinkauf  ',
    clearance: 'uncleared',
    splits: [
      { id: SPLIT_ONE, categoryId: CATEGORY, amount: -6_000 as Money },
      { id: SPLIT_TWO, categoryId: CATEGORY, amount: -4_000 as Money }
    ],
    ...overrides
  };
}

function expectations(revision = 0): readonly { id: UUID; expectedRevision: number }[] {
  return [
    { id: TRANSACTION, expectedRevision: revision },
    { id: ACCOUNT, expectedRevision: 1 },
    { id: CATEGORY, expectedRevision: 1 },
    { id: PAYEE, expectedRevision: 1 }
  ];
}

function allHeads(transactionRevision?: number): AggregateHeadReader {
  return reader(
    ...(transactionRevision === undefined ? [] : [head(TRANSACTION, transactionRevision, 'transaction')]),
    head(ACCOUNT, 1, 'account'),
    head(CATEGORY, 1, 'category'),
    head(PAYEE, 1, 'payee')
  );
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

describe('Buchungen und Splits', () => {
  it('speichert vollständige negative Splits und eine positive Ausgabenerstattung exakt', () => {
    const expense = saveTransaction(
      {
        commandType: 'transaction.save',
        spaceId: SPACE,
        expectedRevisions: expectations(),
        mutations: [{ aggregate: transaction() }]
      },
      allHeads(),
      dependencies()
    );
    expect(expense.aggregates[0]).toMatchObject({ note: 'Wocheneinkauf', amount: -10_000 });

    const refund = transaction({
      id: '00000000-0000-4000-8000-000000000017' as UUID,
      amount: 1_500 as Money,
      splits: [{ id: SPLIT_ONE, categoryId: CATEGORY, amount: 1_500 as Money }]
    });
    const refunded = saveTransaction(
      {
        commandType: 'transaction.save',
        spaceId: SPACE,
        expectedRevisions: [
          { id: refund.id, expectedRevision: 0 },
          { id: ACCOUNT, expectedRevision: 1 },
          { id: CATEGORY, expectedRevision: 1 },
          { id: PAYEE, expectedRevision: 1 }
        ],
        mutations: [{ aggregate: refund }]
      },
      allHeads(),
      dependencies()
    );
    expect(refunded.aggregates[0]).toMatchObject({ amount: 1_500, splits: [{ amount: 1_500 }] });
  });

  it('weist unvollständige oder überlaufende Splits vor dem Änderungsset ab', () => {
    expectDomainError(
      () =>
        saveTransaction(
          {
            commandType: 'transaction.save',
            spaceId: SPACE,
            expectedRevisions: expectations(),
            mutations: [{ aggregate: transaction({ splits: [{ id: SPLIT_ONE, categoryId: CATEGORY, amount: -9_999 as Money }] }) }]
          },
          allHeads(),
          dependencies()
        ),
      'INVALID_AGGREGATE'
    );

    expectDomainError(
      () =>
        saveTransaction(
          {
            commandType: 'transaction.save',
            spaceId: SPACE,
            expectedRevisions: expectations(),
            mutations: [
              {
                aggregate: transaction({
                  amount: 0 as Money,
                  splits: [
                    { id: SPLIT_ONE, categoryId: CATEGORY, amount: Number.MAX_SAFE_INTEGER as Money },
                    { id: SPLIT_TWO, categoryId: CATEGORY, amount: 1 as Money }
                  ]
                })
              }
            ]
          },
          allHeads(),
          dependencies()
        ),
      'MONEY_OVERFLOW'
    );
  });

  it('löscht nur nicht abgeglichene Buchungen als Tombstone', () => {
    const deleted = deleteTransaction(
      {
        commandType: 'transaction.delete',
        spaceId: SPACE,
        expectedRevisions: expectations(1),
        mutations: [{ aggregate: transaction() }]
      },
      allHeads(1),
      dependencies()
    );
    expect(deleted.aggregates[0]).toMatchObject({ revision: 2, deletedAt: NOW });

    expectDomainError(
      () =>
        deleteTransaction(
          {
            commandType: 'transaction.delete',
            spaceId: SPACE,
            expectedRevisions: expectations(1),
            mutations: [{ aggregate: transaction({ clearance: 'reconciled' }) }]
          },
          allHeads(1),
          dependencies()
        ),
      'INVALID_COMMAND'
    );
  });
});
