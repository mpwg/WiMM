// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { Money, UUID } from '@wimm/contracts';

import {
  rebuildFinancialProjections,
  type CategoryAggregate,
  type CategoryGroupAggregate,
  type TransactionAggregate
} from './index.js';

const SPACE = '00000000-0000-4000-8000-000000000001' as UUID;
const ACCOUNT_ONE = '00000000-0000-4000-8000-000000000011' as UUID;
const ACCOUNT_TWO = '00000000-0000-4000-8000-000000000012' as UUID;
const EXPENSE_GROUP = '00000000-0000-4000-8000-000000000013' as UUID;
const INCOME_GROUP = '00000000-0000-4000-8000-000000000014' as UUID;
const EXPENSE_CATEGORY = '00000000-0000-4000-8000-000000000015' as UUID;
const INCOME_CATEGORY = '00000000-0000-4000-8000-000000000016' as UUID;
const TRANSFER = '00000000-0000-4000-8000-000000000017' as UUID;
const NOW = '2026-10-03T12:00:00Z';

function group(id: UUID, kind: CategoryGroupAggregate['kind']): CategoryGroupAggregate {
  return {
    id,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'categoryGroup',
    name: kind === 'income' ? 'Einnahmen' : 'Ausgaben',
    kind,
    sortOrder: 0,
    archived: false
  };
}

function category(id: UUID, groupId: UUID): CategoryAggregate {
  return {
    id,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'category',
    groupId,
    name: 'Kategorie',
    sortOrder: 0,
    archived: false
  };
}

function transaction(input: {
  readonly id: UUID;
  readonly accountId: UUID;
  readonly amount: Money;
  readonly kind: TransactionAggregate['kind'];
  readonly categoryId?: UUID;
  readonly transferId?: UUID;
}): TransactionAggregate {
  return {
    id: input.id,
    spaceId: SPACE,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'transaction',
    accountId: input.accountId,
    date: '2026-10-03',
    amount: input.amount,
    kind: input.kind,
    clearance: 'uncleared',
    ...(input.transferId === undefined ? {} : { transferId: input.transferId }),
    splits:
      input.categoryId === undefined
        ? []
        : [
            {
              id: `${input.id.slice(0, -1)}9` as UUID,
              categoryId: input.categoryId,
              amount: input.amount
            }
          ]
  };
}

const categories = [category(EXPENSE_CATEGORY, EXPENSE_GROUP), category(INCOME_CATEGORY, INCOME_GROUP)];
const categoryGroups = [group(EXPENSE_GROUP, 'expense'), group(INCOME_GROUP, 'income')];

describe('reproduzierbare Finanzprojektionen', () => {
  it('berechnet F01 aus Anfangsbestand, Ausgabe und Einnahme ohne den Anfang als Einkommen', () => {
    const input = {
      transactions: [
        transaction({ id: '00000000-0000-4000-8000-000000000101' as UUID, accountId: ACCOUNT_ONE, amount: 100_000 as Money, kind: 'opening' }),
        transaction({ id: '00000000-0000-4000-8000-000000000102' as UUID, accountId: ACCOUNT_ONE, amount: -10_000 as Money, kind: 'normal', categoryId: EXPENSE_CATEGORY }),
        transaction({ id: '00000000-0000-4000-8000-000000000103' as UUID, accountId: ACCOUNT_ONE, amount: 20_000 as Money, kind: 'normal', categoryId: INCOME_CATEGORY })
      ],
      categories,
      categoryGroups
    };
    const first = rebuildFinancialProjections(input);
    const second = rebuildFinancialProjections(input);
    const incremental = input.transactions.map((_, index) =>
      rebuildFinancialProjections({
        ...input,
        transactions: input.transactions.slice(0, index + 1)
      })
    );

    expect(first).toEqual(second);
    expect(first).toEqual(incremental.at(-1));
    expect(first.accountBalances).toEqual([{ accountId: ACCOUNT_ONE, balance: 110_000 }]);
    expect(first.consumption).toMatchObject({ income: 20_000, expense: 10_000, net: 10_000 });
  });

  it('berechnet F03 transferfrei im Verbrauch und erhält das Gesamtvermögen', () => {
    const projections = rebuildFinancialProjections({
      transactions: [
        transaction({ id: '00000000-0000-4000-8000-000000000104' as UUID, accountId: ACCOUNT_ONE, amount: 100_000 as Money, kind: 'opening' }),
        transaction({ id: '00000000-0000-4000-8000-000000000105' as UUID, accountId: ACCOUNT_TWO, amount: 0 as Money, kind: 'opening' }),
        transaction({ id: '00000000-0000-4000-8000-000000000106' as UUID, accountId: ACCOUNT_ONE, amount: -20_000 as Money, kind: 'transfer', transferId: TRANSFER }),
        transaction({ id: '00000000-0000-4000-8000-000000000107' as UUID, accountId: ACCOUNT_TWO, amount: 20_000 as Money, kind: 'transfer', transferId: TRANSFER })
      ],
      categories,
      categoryGroups
    });

    expect(projections.accountBalances).toEqual([
      { accountId: ACCOUNT_ONE, balance: 80_000 },
      { accountId: ACCOUNT_TWO, balance: 20_000 }
    ]);
    expect(projections.consumption).toMatchObject({ income: 0, expense: 0, net: 0, categories: [] });
  });

  it('zählt positive Erstattungen in einer Ausgabenkategorie gegen den Verbrauch', () => {
    const projections = rebuildFinancialProjections({
      transactions: [
        transaction({ id: '00000000-0000-4000-8000-000000000108' as UUID, accountId: ACCOUNT_ONE, amount: -10_000 as Money, kind: 'normal', categoryId: EXPENSE_CATEGORY }),
        transaction({ id: '00000000-0000-4000-8000-000000000109' as UUID, accountId: ACCOUNT_ONE, amount: 1_500 as Money, kind: 'normal', categoryId: EXPENSE_CATEGORY })
      ],
      categories,
      categoryGroups
    });
    expect(projections.consumption).toMatchObject({ income: 0, expense: 8_500, net: -8_500 });
  });
});
