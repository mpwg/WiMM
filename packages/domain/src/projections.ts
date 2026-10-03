// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Money, UUID } from '@wimm/contracts';

import type { CategoryAggregate, CategoryGroupAggregate } from './master-data.js';
import { DomainValidationError } from './errors.js';
import { subtractMoney, sumMoney } from './money.js';
import type { TransactionAggregate } from './transactions.js';

export interface AccountBalanceProjection {
  readonly accountId: UUID;
  readonly balance: Money;
}

export interface CategoryConsumptionProjection {
  readonly categoryId: UUID;
  readonly groupKind: 'income' | 'expense';
  /** Vorzeichenbehaftete Split-Summe; Ausgaben bleiben negativ. */
  readonly amount: Money;
}

export interface ConsumptionProjection {
  readonly income: Money;
  /** Positiver Verbrauch; Erstattungen mindern ihn und können ihn negativ machen. */
  readonly expense: Money;
  readonly net: Money;
  readonly categories: readonly CategoryConsumptionProjection[];
}

export interface FinancialProjections {
  readonly accountBalances: readonly AccountBalanceProjection[];
  readonly consumption: ConsumptionProjection;
}

/** Baut Kontosalden ausschließlich aus nicht gelöschten Buchungen reproduzierbar neu auf. */
export function projectAccountBalances(
  transactions: readonly TransactionAggregate[]
): readonly AccountBalanceProjection[] {
  const amounts = new Map<UUID, Money[]>();
  for (const transaction of transactions) {
    if (transaction.deletedAt !== undefined) {
      continue;
    }
    const current = amounts.get(transaction.accountId) ?? [];
    current.push(transaction.amount);
    amounts.set(transaction.accountId, current);
  }
  return Object.freeze(
    [...amounts.entries()]
      .map(([accountId, values]) => Object.freeze({ accountId, balance: sumMoney(values, 'Der Kontostand') }))
      .sort((left, right) => left.accountId.localeCompare(right.accountId))
  );
}

/** Leitet Einnahmen und Verbrauch aus normalen, nicht gelöschten Buchungssplits ab. */
export function projectConsumption(
  transactions: readonly TransactionAggregate[],
  categories: readonly CategoryAggregate[],
  categoryGroups: readonly CategoryGroupAggregate[]
): ConsumptionProjection {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const groupsById = new Map(categoryGroups.map((group) => [group.id, group]));
  const categoryAmounts = new Map<UUID, Money[]>();
  let income = 0 as Money;
  let expenseRaw = 0 as Money;

  for (const transaction of transactions) {
    if (transaction.deletedAt !== undefined || transaction.kind !== 'normal') {
      continue;
    }
    for (const split of transaction.splits) {
      const category = categoriesById.get(split.categoryId);
      const group = category === undefined ? undefined : groupsById.get(category.groupId);
      if (category === undefined || group === undefined) {
        throw new DomainValidationError(
          'INVALID_AGGREGATE',
          'Eine Verbrauchsprojektion benötigt jede referenzierte Kategorie und Kategoriegruppe.'
        );
      }
      const existing = categoryAmounts.get(category.id) ?? [];
      existing.push(split.amount);
      categoryAmounts.set(category.id, existing);
      if (group.kind === 'income') {
        income = sumMoney([income, split.amount], 'Die Einnahmensumme');
      } else {
        expenseRaw = sumMoney([expenseRaw, split.amount], 'Die Ausgabensumme');
      }
    }
  }

  const expense = subtractMoney(0 as Money, expenseRaw, 'Der Verbrauch');
  return Object.freeze({
    income,
    expense,
    net: subtractMoney(income, expense, 'Der Verbrauchssaldo'),
    categories: Object.freeze(
      [...categoryAmounts.entries()]
        .map(([categoryId, amounts]) => {
          const category = categoriesById.get(categoryId)!;
          const group = groupsById.get(category.groupId)!;
          return Object.freeze({
            categoryId,
            groupKind: group.kind,
            amount: sumMoney(amounts, 'Die Kategoriesumme')
          });
        })
        .sort((left, right) => left.categoryId.localeCompare(right.categoryId))
    )
  });
}

/** Erzeugt alle P2-Basisprojektionen aus demselben unveränderlichen Aggregatbestand. */
export function rebuildFinancialProjections(input: {
  readonly transactions: readonly TransactionAggregate[];
  readonly categories: readonly CategoryAggregate[];
  readonly categoryGroups: readonly CategoryGroupAggregate[];
}): FinancialProjections {
  return Object.freeze({
    accountBalances: projectAccountBalances(input.transactions),
    consumption: projectConsumption(input.transactions, input.categories, input.categoryGroups)
  });
}
