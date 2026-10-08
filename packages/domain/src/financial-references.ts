// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import type { P2Aggregate, P2AggregateType } from './commands.js';
import type { CategoryAggregate } from './master-data.js';
import type { TransactionAggregate } from './transactions.js';
import type { TransferAggregate } from './transfers.js';
import { DomainValidationError } from './errors.js';

/** Neue Referenzen benötigen lebende Ziele; unveränderte historische Referenzen bleiben erhalten. */
export function validateFinancialReferences(changes: readonly P2Aggregate[], current: readonly P2Aggregate[]): void {
  const before = new Map(current.map((aggregate) => [aggregate.id, aggregate]));
  const after = new Map(before);
  for (const aggregate of changes) after.set(aggregate.id, aggregate);
  function requireTarget(id: UUID, type: P2AggregateType, spaceId: UUID): P2Aggregate {
    const target = after.get(id);
    if (target === undefined || target.aggregateType !== type || target.spaceId !== spaceId || target.deletedAt !== undefined) {
      throw new DomainValidationError('INVALID_AGGREGATE', 'Neue Finanzreferenzen benötigen ein vorhandenes, nicht gelöschtes Ziel im selben Bereich.');
    }
    return target;
  }
  function requireCategory(id: UUID, spaceId: UUID): void {
    const category = requireTarget(id, 'category', spaceId) as CategoryAggregate;
    requireTarget(category.groupId, 'categoryGroup', spaceId);
  }
  for (const aggregate of changes) {
    if (aggregate.deletedAt !== undefined) continue;
    const stored = before.get(aggregate.id);
    const previous = stored?.deletedAt === undefined ? stored : undefined;
    if (aggregate.aggregateType === 'category') {
      const category = aggregate as CategoryAggregate;
      if ((previous as CategoryAggregate | undefined)?.groupId !== category.groupId) requireTarget(category.groupId, 'categoryGroup', category.spaceId);
    } else if (aggregate.aggregateType === 'transaction') {
      const transaction = aggregate as TransactionAggregate;
      const old = previous as TransactionAggregate | undefined;
      if (old?.accountId !== transaction.accountId) requireTarget(transaction.accountId, 'account', transaction.spaceId);
      if (transaction.payeeId !== undefined && old?.payeeId !== transaction.payeeId) requireTarget(transaction.payeeId, 'payee', transaction.spaceId);
      if (transaction.transferId !== undefined && old?.transferId !== transaction.transferId) requireTarget(transaction.transferId, 'transfer', transaction.spaceId);
      const splits = new Map(old?.splits.map((split) => [split.id, split.categoryId]) ?? []);
      for (const split of transaction.splits) if (splits.get(split.id) !== split.categoryId) requireCategory(split.categoryId, transaction.spaceId);
    } else if (aggregate.aggregateType === 'transfer') {
      const transfer = aggregate as TransferAggregate;
      const old = previous as TransferAggregate | undefined;
      for (const field of ['sourceAccountId', 'targetAccountId'] as const) if (old?.[field] !== transfer[field]) requireTarget(transfer[field], 'account', transfer.spaceId);
      for (const field of ['sourceTransactionId', 'targetTransactionId'] as const) if (old?.[field] !== transfer[field]) requireTarget(transfer[field], 'transaction', transfer.spaceId);
      if (transfer.budgetCategoryId !== undefined && old?.budgetCategoryId !== transfer.budgetCategoryId) requireCategory(transfer.budgetCategoryId, transfer.spaceId);
    }
  }
}
