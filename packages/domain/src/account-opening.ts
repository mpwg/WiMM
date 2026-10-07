// SPDX-License-Identifier: AGPL-3.0-or-later
import { createAggregateMetadata, createChangeSet, type AggregateHeadReader, type DomainChangeSet, type DomainDependencies } from './commands.js';
import { saveAccount, type AccountAggregate } from './master-data.js';
import { saveTransaction, type TransactionAggregate } from './transactions.js';
import { parseMoney } from './money.js';
import { parseFinanceDate } from './calendar.js';
import { DomainValidationError } from './errors.js';

/** Neues Konto und optionaler Anfangsbestand sind eine einzige atomare Änderungsmenge. */
export function createAccountWithOpening(account: AccountAggregate, opening: { readonly amount: string; readonly date: string } | undefined, heads: AggregateHeadReader, dependencies: DomainDependencies): DomainChangeSet<'account.save', AccountAggregate | TransactionAggregate> {
  if (opening !== undefined && heads.list === undefined) throw new DomainValidationError('INVALID_COMMAND', 'Finanzänderungen benötigen den vollständigen aktuellen Fachbestand.');
  if (account.revision !== 1 || heads.get(account.id) !== undefined) throw new DomainValidationError('INVALID_COMMAND', 'Der Kontoeinstieg ist nur für ein neues Konto zulässig.');
  const saved = saveAccount({ commandType: 'account.save', spaceId: account.spaceId, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], mutations: [{ aggregate: account }] }, heads, dependencies).aggregates[0]!;
  if (opening === undefined) return createChangeSet({ commandType: 'account.save', spaceId: account.spaceId, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], mutations: [{ aggregate: saved }] }, heads, dependencies);
  const transaction: TransactionAggregate = { ...createAggregateMetadata(account.spaceId, dependencies), aggregateType: 'transaction', accountId: account.id, amount: parseMoney(opening.amount, 'Der Anfangsbestand'), date: parseFinanceDate(opening.date), kind: 'opening', clearance: 'uncleared', splits: [] };
  const pendingHeads: AggregateHeadReader = { get: id => id === account.id ? saved : heads.get(id), list: spaceId => [...(heads.list?.(spaceId) ?? []), saved] };
  const validated = saveTransaction({ commandType: 'transaction.save', spaceId: account.spaceId, expectedRevisions: [{ id: transaction.id, expectedRevision: 0 }, { id: account.id, expectedRevision: saved.revision }], mutations: [{ aggregate: transaction }] }, pendingHeads, dependencies).aggregates[0]!;
  return createChangeSet<'account.save', AccountAggregate | TransactionAggregate>({ commandType: 'account.save', spaceId: account.spaceId, expectedRevisions: [{ id: account.id, expectedRevision: 0 }, { id: transaction.id, expectedRevision: 0 }], mutations: [{ aggregate: saved }, { aggregate: validated }] }, heads, dependencies);
}
