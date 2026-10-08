// SPDX-License-Identifier: AGPL-3.0-or-later
import { yearMonthSchema, type UUID } from '@wimm/contracts';
import { validateFinancialState, rebuildFinancialProjections, projectConsumption, type TransactionAggregate, type CategoryAggregate, type CategoryGroupAggregate } from '@wimm/domain';
import type { StoredAggregate, StoredProjection } from './contracts.js';

/** Nur Speicherform: jede Centberechnung und Bestandsprüfung kommt aus dem Fachkern. */
export function rebuildStoredProjections(aggregates: readonly StoredAggregate[], spaceId: UUID, previous: readonly StoredProjection[] = []): readonly StoredProjection[] {
  validateFinancialState(aggregates, spaceId);
  const transactions = aggregates.filter((entry): entry is StoredAggregate & TransactionAggregate => entry.aggregateType === 'transaction');
  const categories = aggregates.filter((entry): entry is StoredAggregate & CategoryAggregate => entry.aggregateType === 'category');
  const categoryGroups = aggregates.filter((entry): entry is StoredAggregate & CategoryGroupAggregate => entry.aggregateType === 'categoryGroup');
  const rebuilt = rebuildFinancialProjections({ transactions, categories, categoryGroups });
  const balances = new Map(rebuilt.accountBalances.map((entry) => [entry.accountId, entry.balance]));
  const accounts = aggregates.filter((entry) => entry.aggregateType === 'account').toSorted((a, b) => a.id.localeCompare(b.id));
  const result: StoredProjection[] = accounts.map((account) => ({ spaceId, kind: 'accountBalance', key: account.id, payload: { balance: balances.get(account.id) ?? 0 } }));
  // Historische numerische Saldo-Adressen bleiben vorhanden, ihre Werte werden neu berechnet.
  const legacy = new Set(previous.filter((entry) => entry.kind === 'balance').map((entry) => entry.key));
  for (const account of accounts) if (legacy.has(account.id)) result.push({ spaceId, kind: 'balance', key: account.id, payload: balances.get(account.id) ?? 0 });
  result.push({ spaceId, kind: 'consumption', key: 'all', payload: rebuilt.consumption });
  const months = new Set(transactions.filter((entry) => entry.deletedAt === undefined).map((entry) => entry.date.slice(0, 7)));
  for (const projection of previous) if (projection.kind === 'consumption' && yearMonthSchema.safeParse(projection.key).success) months.add(projection.key);
  for (const month of [...months].sort()) result.push({ spaceId, kind: 'consumption', key: month, payload: projectConsumption(transactions.filter((entry) => entry.date.slice(0, 7) === month), categories, categoryGroups) });
  return result;
}
