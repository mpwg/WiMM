// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import { createChangeSet, reviseAggregate, type DomainChangeSet, type DomainDependencies, type P2Aggregate, type RevisionExpectation } from './commands.js';
import { DomainValidationError } from './errors.js';
import type { AccountAggregate, CategoryAggregate, CategoryGroupAggregate } from './master-data.js';
import { deleteTransaction, saveTransaction, type TransactionAggregate } from './transactions.js';
import { confirmReconciliation, deleteTransfer, saveTransfer, unlockReconciliation, type ReconciliationAggregate, type TransferAggregate } from './transfers.js';

/** Verbundene Abgleiche einschließlich beider Transferseiten gemeinsam entsperren. */
export function unlockFinanceSelection(spaceId: UUID, selectedId: UUID, aggregates: readonly P2Aggregate[], dependencies: DomainDependencies): DomainChangeSet {
  const heads = { get: (id: UUID) => aggregates.find((entry) => entry.id === id) };
  const transactions = aggregates.filter((entry): entry is TransactionAggregate => entry.aggregateType === 'transaction' && entry.deletedAt === undefined);
  const reconciliations = aggregates.filter((entry): entry is ReconciliationAggregate => entry.aggregateType === 'reconciliation' && entry.deletedAt === undefined);
  const ids = new Set([selectedId]); const groups = new Set<UUID>();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const transaction of transactions.filter((entry) => ids.has(entry.id))) {
      if (transaction.transferId !== undefined) {
        const transfer = heads.get(transaction.transferId) as TransferAggregate | undefined;
        if (transfer === undefined || transfer.aggregateType !== 'transfer' || transfer.deletedAt !== undefined) throw new DomainValidationError('INVALID_AGGREGATE', 'Die vollständige Umbuchung fehlt.');
        for (const id of [transfer.sourceTransactionId, transfer.targetTransactionId]) if (!ids.has(id)) { ids.add(id); expanded = true; }
      }
    }
    for (const group of reconciliations) if (!groups.has(group.id) && group.transactionIds.some((id) => ids.has(id))) {
      groups.add(group.id); for (const id of group.transactionIds) ids.add(id); expanded = true;
    }
  }
  const changes = reconciliations.filter((entry) => groups.has(entry.id)).map((reconciliation) => unlockReconciliation({ spaceId, reconciliation, transactions: reconciliation.transactionIds.map((id) => {
    const transaction = transactions.find((entry) => entry.id === id);
    if (transaction === undefined) throw new DomainValidationError('INVALID_AGGREGATE', 'Eine Abgleichbuchung fehlt.');
    return transaction;
  }) }, heads, dependencies));
  if (changes.length === 0 || transactions.some((entry) => ids.has(entry.id) && entry.clearance === 'reconciled' && !reconciliations.some((group) => groups.has(group.id) && group.transactionIds.includes(entry.id)))) throw new DomainValidationError('INVALID_COMMAND', 'Der zugehörige vollständige Abgleich fehlt.');
  const changed = new Map(changes.flatMap((change) => change.aggregates.map((entry) => [entry.id, entry] as const)));
  const expectations = new Map(changes.flatMap((change) => change.expectedRevisions.map((entry) => [entry.id, entry] as const)));
  for (const transaction of transactions.filter((entry) => ids.has(entry.id))) {
    if (!changed.has(transaction.id)) changed.set(transaction.id, reviseAggregate(transaction, dependencies));
    expectations.set(transaction.id, { id: transaction.id, expectedRevision: transaction.revision });
    if (transaction.transferId !== undefined) {
      const transfer = heads.get(transaction.transferId)!;
      expectations.set(transfer.id, { id: transfer.id, expectedRevision: transfer.revision });
    }
  }
  return createChangeSet({ commandType: 'reconciliation.unlock', spaceId, expectedRevisions: [...expectations.values()], mutations: [...changed.values()].map((aggregate) => ({ aggregate })) }, heads, dependencies);
}

export interface FinanceInverse {
  readonly spaceId: UUID;
  readonly expectedRevisions: readonly RevisionExpectation[];
  readonly targets: readonly { readonly id: UUID; readonly previous?: P2Aggregate }[];
}

/** Gegenbefehle betreffen ausschließlich die Aktion; niemals einen Bereichssnapshot. */
export function reverseFinanceAction(inverse: FinanceInverse, aggregates: readonly P2Aggregate[], dependencies: DomainDependencies): DomainChangeSet {
  if (inverse.targets.some((entry) => entry.previous !== undefined && !['transaction', 'transfer', 'reconciliation'].includes(entry.previous.aggregateType))) throw new DomainValidationError('INVALID_COMMAND', 'Nur Finanzaktionen besitzen Gegenbefehle.');
  const current = new Map(aggregates.map((entry) => [entry.id, entry]));
  const heads = { get: (id: UUID) => current.get(id) };
  const desired = new Map(inverse.targets.map(({ id, previous }) => {
    const head = current.get(id);
    if (head === undefined || !['transaction', 'transfer', 'reconciliation'].includes(head.aggregateType) || head.spaceId !== inverse.spaceId) throw new DomainValidationError('REVISION_CONFLICT', 'Die Aktion gehört nicht zum aktuellen Bereich.');
    const { deletedAt: _deleted, ...live } = previous ?? head;
    return [id, reviseAggregate(previous === undefined || previous.deletedAt !== undefined ? { ...head, deletedAt: dependencies.clock.now() } : { ...live, revision: head.revision }, dependencies)] as const;
  }));
  // Die ursprünglichen Erwartungen werden geprüft, bevor aktuelle Referenzen benutzt werden.
  createChangeSet({ commandType: 'transaction.save', spaceId: inverse.spaceId, expectedRevisions: inverse.expectedRevisions, mutations: [...desired.values()].map((aggregate) => ({ aggregate })) }, heads, dependencies);
  const changes: DomainChangeSet[] = []; const owned = new Set<UUID>();
  for (const entry of desired.values()) if (entry.aggregateType === 'reconciliation') {
    const reconciliation = entry as ReconciliationAggregate;
    const transactions = reconciliation.transactionIds.map((id) => {
      owned.add(id); const transaction = current.get(id) as TransactionAggregate | undefined;
      if (transaction === undefined) throw new DomainValidationError('INVALID_AGGREGATE', 'Die Abgleichbuchung fehlt.');
      return transaction;
    });
    if (reconciliation.deletedAt !== undefined) {
      const change = unlockReconciliation({ spaceId: inverse.spaceId, reconciliation: current.get(entry.id) as ReconciliationAggregate, transactions }, heads, dependencies);
      changes.push({ ...change, aggregates: change.aggregates.map((aggregate) => {
        const target = desired.get(aggregate.id) as TransactionAggregate | undefined;
        if (aggregate.aggregateType === 'transaction' && target !== undefined) {
          if (target.clearance !== 'cleared' && target.clearance !== 'uncleared') throw new DomainValidationError('INVALID_COMMAND', 'Ungültiger Gegenbefehl zum Entsperren.');
          return { ...aggregate, clearance: target.clearance };
        }
        return aggregate;
      }) });
    } else {
      const previousTransactions = aggregates.filter((aggregate): aggregate is TransactionAggregate => aggregate.aggregateType === 'transaction' && aggregate.deletedAt === undefined && (aggregate as TransactionAggregate).accountId === reconciliation.accountId && (aggregate as TransactionAggregate).clearance === 'reconciled' && (aggregate as TransactionAggregate).date <= reconciliation.statementDate && !owned.has(aggregate.id));
      changes.push(confirmReconciliation({ spaceId: inverse.spaceId, reconciliation, transactions, previousTransactions }, heads, dependencies).changeSet);
    }
  }
  for (const entry of desired.values()) if (entry.aggregateType === 'transfer') {
    const transfer = entry as TransferAggregate;
    const source = (transfer.deletedAt === undefined ? desired : current).get(transfer.sourceTransactionId) as TransactionAggregate;
    const target = (transfer.deletedAt === undefined ? desired : current).get(transfer.targetTransactionId) as TransactionAggregate;
    if (source === undefined || target === undefined) throw new DomainValidationError('INVALID_AGGREGATE', 'Der Gegenbefehl benötigt beide Umbuchungsseiten.');
    owned.add(source.id); owned.add(target.id);
    const budgetCategory = current.get(transfer.budgetCategoryId!) as CategoryAggregate | undefined;
    const budgetGroup = (budgetCategory === undefined ? undefined : current.get(budgetCategory.groupId)) as CategoryGroupAggregate | undefined;
    const input = { ...(budgetCategory === undefined ? {} : { budgetCategory }), ...(budgetGroup === undefined ? {} : { budgetGroup }), spaceId: inverse.spaceId, transfer: transfer.deletedAt === undefined ? transfer : current.get(transfer.id) as TransferAggregate, source, target, sourceAccount: current.get(transfer.sourceAccountId) as AccountAggregate, targetAccount: current.get(transfer.targetAccountId) as AccountAggregate };
    changes.push(transfer.deletedAt === undefined ? saveTransfer(input, heads, dependencies) : deleteTransfer(input, heads, dependencies));
  }
  for (const entry of desired.values()) if (entry.aggregateType === 'transaction' && !owned.has(entry.id)) {
    const transaction = entry as TransactionAggregate;
    if (transaction.kind === 'transfer') {
      // Beim Entsperren kann eine bereits freie Gegenbuchung nur unverändert mitgeführt werden.
      const head = current.get(entry.id) as TransactionAggregate;
      const { revision: _r, updatedAt: _u, ...before } = head;
      const { revision: _rr, updatedAt: _uu, ...after } = transaction;
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new DomainValidationError('INVALID_COMMAND', 'Eine einzelne Umbuchungsseite darf nicht geändert werden.');
      continue;
    }
    const expectedRevisions = [{ id: transaction.id, expectedRevision: current.get(transaction.id)!.revision }, ...[...new Set([transaction.accountId, ...transaction.splits.map((split) => split.categoryId), ...(transaction.payeeId === undefined ? [] : [transaction.payeeId])])].map((id) => {
      const head = current.get(id); if (head === undefined) throw new DomainValidationError('INVALID_AGGREGATE', 'Eine Referenz fehlt.');
      return { id, expectedRevision: head.revision };
    })];
    changes.push(transaction.deletedAt === undefined ? saveTransaction({ commandType: 'transaction.save', spaceId: inverse.spaceId, expectedRevisions, mutations: [{ aggregate: transaction }] }, heads, dependencies) : deleteTransaction({ commandType: 'transaction.delete', spaceId: inverse.spaceId, expectedRevisions, mutations: [{ aggregate: current.get(entry.id) as TransactionAggregate }] }, heads, dependencies));
  }
  const changed = new Map(changes.flatMap((change) => change.aggregates.map((entry) => [entry.id, entry] as const)));
  for (const [id, aggregate] of desired) if (!changed.has(id)) changed.set(id, aggregate);
  const expectations = new Map([...inverse.expectedRevisions, ...changes.flatMap((change) => change.expectedRevisions)].map((entry) => [entry.id, entry]));
  return createChangeSet({ commandType: changes[0]?.commandType ?? 'reconciliation.unlock', spaceId: inverse.spaceId, expectedRevisions: [...expectations.values()], mutations: [...changed.values()].map((aggregate) => ({ aggregate })) }, heads, dependencies);
}
