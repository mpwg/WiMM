// SPDX-License-Identifier: AGPL-3.0-or-later
import { uuidSchema } from '@wimm/contracts';
import type { IsoDate, Money, Revision, UUID } from '@wimm/contracts';

import {
  createChangeSet,
  reviseAggregate,
  type AggregateHeadReader,
  type DomainChangeSet,
  type DomainDependencies,
  type P2Aggregate,
  type P2AggregateType,
  type RevisionExpectation
} from './commands.js';
import type { AccountAggregate } from './master-data.js';
import { DomainValidationError } from './errors.js';
import { assertMoney, subtractMoney } from './money.js';
import { normalizeTransaction, type TransactionAggregate } from './transactions.js';

export interface TransferFields {
  readonly date: IsoDate;
  readonly sourceAccountId: UUID;
  readonly targetAccountId: UUID;
  readonly sourceTransactionId: UUID;
  readonly targetTransactionId: UUID;
  readonly amount: Money;
  readonly budgetCategoryId?: UUID;
}

export type TransferAggregate = P2Aggregate<'transfer', TransferFields>;

export interface ReconciliationFields {
  readonly accountId: UUID;
  readonly statementDate: IsoDate;
  readonly statementBalance: Money;
  readonly transactionIds: readonly UUID[];
}

export type ReconciliationAggregate = P2Aggregate<'reconciliation', ReconciliationFields>;

export interface TransferCommandInput {
  readonly spaceId: UUID;
  readonly transfer: TransferAggregate;
  readonly source: TransactionAggregate;
  readonly target: TransactionAggregate;
  readonly sourceAccount: AccountAggregate;
  readonly targetAccount: AccountAggregate;
}

export interface ReconciliationCommandInput {
  readonly spaceId: UUID;
  readonly reconciliation: ReconciliationAggregate;
  readonly transactions: readonly TransactionAggregate[];
}

export interface ReconciliationConfirmation {
  readonly changeSet: DomainChangeSet<'reconciliation.confirm'>;
  readonly difference: Money;
}

/** Speichert eine Umbuchung ausschließlich zusammen mit beiden vollständigen Gegenbuchungen. */
export function saveTransfer(
  input: TransferCommandInput,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'transfer.save'> {
  const { transfer, source, target } = normalizeTransfer(input);
  const expectations = transferExpectations(input, transfer, heads, true);
  return createChangeSet<'transfer.save', TransferAggregate | TransactionAggregate>(
    {
      commandType: 'transfer.save',
      spaceId: input.spaceId,
      expectedRevisions: expectations,
      mutations: [{ aggregate: transfer }, { aggregate: source }, { aggregate: target }]
    },
    heads,
    dependencies
  );
}

/** Löscht Transfer und beide Seiten gemeinsam; abgeglichene Seiten bleiben gesperrt. */
export function deleteTransfer(
  input: TransferCommandInput,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'transfer.delete'> {
  const { transfer, source, target } = normalizeTransfer(input);
  if (source.clearance === 'reconciled' || target.clearance === 'reconciled') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Abgeglichene Umbuchungen müssen vor dem Löschen atomar entsperrt werden.'
    );
  }
  const expectations = transferExpectations(input, transfer, heads, false);
  const tombstoneTransfer = reviseAggregate({ ...transfer, deletedAt: transfer.updatedAt }, dependencies);
  const tombstoneSource = reviseAggregate<TransactionAggregate>(
    { ...source, deletedAt: source.updatedAt },
    dependencies
  );
  const tombstoneTarget = reviseAggregate<TransactionAggregate>(
    { ...target, deletedAt: target.updatedAt },
    dependencies
  );
  return createChangeSet<'transfer.delete', TransferAggregate | TransactionAggregate>(
    {
      commandType: 'transfer.delete',
      spaceId: input.spaceId,
      expectedRevisions: expectations,
      mutations: [
        { aggregate: tombstoneTransfer },
        { aggregate: tombstoneSource },
        { aggregate: tombstoneTarget }
      ]
    },
    heads,
    dependencies
  );
}

/** Bestätigt einen Kontoauszug und sperrt exakt dessen Buchungen atomar. */
export function confirmReconciliation(
  input: ReconciliationCommandInput,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): ReconciliationConfirmation {
  const reconciliation = normalizeReconciliation(input.reconciliation);
  validateReconciliationTransactions(input, reconciliation);
  const updatedTransactions = input.transactions.map((transaction) =>
    reviseAggregate<TransactionAggregate>({ ...transaction, clearance: 'reconciled' }, dependencies)
  );
  const changeSet = createChangeSet<'reconciliation.confirm', ReconciliationAggregate | TransactionAggregate>(
    {
      commandType: 'reconciliation.confirm',
      spaceId: input.spaceId,
      expectedRevisions: reconciliationExpectations(reconciliation, input.transactions, heads, true),
      mutations: [{ aggregate: reconciliation }, ...updatedTransactions.map((aggregate) => ({ aggregate }))]
    },
    heads,
    dependencies
  );
  return Object.freeze({
    changeSet,
    difference: input.transactions.reduce(
      (difference, transaction) => subtractMoney(difference, transaction.amount, 'Die Auszugsdifferenz'),
      reconciliation.statementBalance
    )
  });
}

/** Hebt einen Abgleich und die Sperre exakt der zuvor bestätigten Buchungen gemeinsam auf. */
export function unlockReconciliation(
  input: ReconciliationCommandInput,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'reconciliation.unlock'> {
  const reconciliation = normalizeReconciliation(input.reconciliation);
  validateReconciliationTransactions(input, reconciliation);
  if (input.transactions.some((transaction) => transaction.clearance !== 'reconciled')) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Nur abgeglichene Buchungen können gemeinsam entsperrt werden.'
    );
  }
  const unlockedTransactions = input.transactions.map((transaction) =>
    reviseAggregate<TransactionAggregate>({ ...transaction, clearance: 'cleared' }, dependencies)
  );
  const tombstone = reviseAggregate({ ...reconciliation, deletedAt: reconciliation.updatedAt }, dependencies);
  return createChangeSet<'reconciliation.unlock', ReconciliationAggregate | TransactionAggregate>(
    {
      commandType: 'reconciliation.unlock',
      spaceId: input.spaceId,
      expectedRevisions: reconciliationExpectations(reconciliation, input.transactions, heads, false),
      mutations: [{ aggregate: tombstone }, ...unlockedTransactions.map((aggregate) => ({ aggregate }))]
    },
    heads,
    dependencies
  );
}

function normalizeTransfer(input: TransferCommandInput): {
  readonly transfer: TransferAggregate;
  readonly source: TransactionAggregate;
  readonly target: TransactionAggregate;
} {
  const transfer = input.transfer;
  assertAggregateSpace(transfer, input.spaceId, 'Die Umbuchung');
  assertUuid(transfer.sourceAccountId, 'Das Quellkonto');
  assertUuid(transfer.targetAccountId, 'Das Zielkonto');
  assertUuid(transfer.sourceTransactionId, 'Die Quellbuchung');
  assertUuid(transfer.targetTransactionId, 'Die Zielbuchung');
  assertMoney(transfer.amount, 'Der Umbuchungsbetrag');
  if (transfer.amount <= 0) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Umbuchungsbetrag muss positiv sein.');
  }
  if (transfer.sourceAccountId === transfer.targetAccountId) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Quell- und Zielkonto müssen verschieden sein.');
  }
  const source = normalizeTransaction(input.source);
  const target = normalizeTransaction(input.target);
  assertTransferSide(source, transfer, 'source', input.spaceId);
  assertTransferSide(target, transfer, 'target', input.spaceId);
  if (
    source.id !== transfer.sourceTransactionId ||
    target.id !== transfer.targetTransactionId ||
    source.accountId !== transfer.sourceAccountId ||
    target.accountId !== transfer.targetAccountId ||
    source.date !== transfer.date ||
    target.date !== transfer.date ||
    source.amount !== subtractMoney(0 as Money, transfer.amount, 'Der Quellbetrag') ||
    target.amount !== transfer.amount
  ) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen.'
    );
  }
  validateBudgetBoundary(input, transfer);
  return { transfer, source, target };
}

function transferExpectations(
  input: TransferCommandInput,
  transfer: TransferAggregate,
  heads: AggregateHeadReader,
  mutationsAreNew: boolean
): readonly RevisionExpectation[] {
  const expected = [
    mutationsAreNew ? expectationForMutation(input.transfer) : expectationForCurrent(input.transfer),
    mutationsAreNew ? expectationForMutation(input.source) : expectationForCurrent(input.source),
    mutationsAreNew ? expectationForMutation(input.target) : expectationForCurrent(input.target),
    expectationForRead(input.sourceAccount, 'account', input.spaceId, heads),
    expectationForRead(input.targetAccount, 'account', input.spaceId, heads)
  ];
  if (transfer.budgetCategoryId !== undefined) {
    expected.push(expectationForHead(transfer.budgetCategoryId, 'category', input.spaceId, heads));
  }
  return expected;
}

function normalizeReconciliation(reconciliation: ReconciliationAggregate): ReconciliationAggregate {
  assertAggregateSpace(reconciliation, reconciliation.spaceId, 'Der Abgleich');
  assertUuid(reconciliation.accountId, 'Das Abgleichkonto');
  assertMoney(reconciliation.statementBalance, 'Der Auszugssaldo');
  const ids = new Set<UUID>();
  if (!Array.isArray(reconciliation.transactionIds) || reconciliation.transactionIds.length === 0) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Ein Abgleich benötigt mindestens eine Buchung.');
  }
  for (const id of reconciliation.transactionIds) {
    assertUuid(id, 'Die Abgleichbuchung');
    if (ids.has(id)) {
      throw new DomainValidationError('DUPLICATE_REFERENCE', 'Eine Abgleichbuchung darf nur einmal vorkommen.');
    }
    ids.add(id);
  }
  return reconciliation;
}

function validateReconciliationTransactions(
  input: ReconciliationCommandInput,
  reconciliation: ReconciliationAggregate
): void {
  if (input.spaceId !== reconciliation.spaceId || input.transactions.length !== reconciliation.transactionIds.length) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Abgleich enthält nicht exakt seine Buchungsmenge.');
  }
  const expected = new Set(reconciliation.transactionIds);
  for (const transaction of input.transactions) {
    normalizeTransaction(transaction);
    if (
      transaction.spaceId !== input.spaceId ||
      transaction.accountId !== reconciliation.accountId ||
      transaction.deletedAt !== undefined ||
      !expected.delete(transaction.id)
    ) {
      throw new DomainValidationError('INVALID_AGGREGATE', 'Eine Abgleichbuchung passt nicht zum Kontoauszug.');
    }
  }
  if (expected.size !== 0) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Abgleich enthält nicht exakt seine Buchungsmenge.');
  }
}

function reconciliationExpectations(
  reconciliation: ReconciliationAggregate,
  transactions: readonly TransactionAggregate[],
  heads: AggregateHeadReader,
  reconciliationIsNew: boolean
): readonly RevisionExpectation[] {
  return [
    reconciliationIsNew ? expectationForMutation(reconciliation) : expectationForCurrent(reconciliation),
    ...transactions.map(expectationForCurrent),
    expectationForHead(reconciliation.accountId, 'account', reconciliation.spaceId, heads)
  ];
}

function validateBudgetBoundary(input: TransferCommandInput, transfer: TransferAggregate): void {
  assertAggregateSpace(input.sourceAccount, input.spaceId, 'Das Quellkonto');
  assertAggregateSpace(input.targetAccount, input.spaceId, 'Das Zielkonto');
  if (
    input.sourceAccount.id !== transfer.sourceAccountId ||
    input.targetAccount.id !== transfer.targetAccountId
  ) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Umbuchung verweist nicht auf ihre vollständigen Konten.');
  }
  const crossesBudget = input.sourceAccount.onBudget !== input.targetAccount.onBudget;
  if (crossesBudget && transfer.budgetCategoryId === undefined) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Ein Budgetgrenzübertritt benötigt eine explizite Budgetkategorie.'
    );
  }
  if (!crossesBudget && transfer.budgetCategoryId !== undefined) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Eine Budgetkategorie ist nur beim Budgetgrenzübertritt zulässig.'
    );
  }
}

function assertTransferSide(
  transaction: TransactionAggregate,
  transfer: TransferAggregate,
  side: 'source' | 'target',
  spaceId: UUID
): void {
  assertAggregateSpace(transaction, spaceId, 'Die Umbuchungsbuchung');
  if (transaction.kind !== 'transfer' || transaction.transferId !== transfer.id || transaction.splits.length !== 0) {
    throw new DomainValidationError('INVALID_AGGREGATE', `Die ${side === 'source' ? 'Quell' : 'Ziel'}seite ist keine vollständige Umbuchungsseite.`);
  }
}

function expectationForMutation(aggregate: P2Aggregate): RevisionExpectation {
  if (aggregate.revision < 1) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Ein Aggregat benötigt eine positive Revision.');
  }
  return { id: aggregate.id, expectedRevision: (aggregate.revision - 1) as Revision };
}

function expectationForCurrent(aggregate: P2Aggregate): RevisionExpectation {
  return { id: aggregate.id, expectedRevision: aggregate.revision };
}

function expectationForRead(
  aggregate: P2Aggregate,
  aggregateType: P2AggregateType,
  spaceId: UUID,
  heads: AggregateHeadReader
): RevisionExpectation {
  assertAggregateSpace(aggregate, spaceId, 'Eine gelesene Referenz');
  return expectationForHead(aggregate.id, aggregateType, spaceId, heads);
}

function expectationForHead(
  id: UUID,
  aggregateType: P2AggregateType,
  spaceId: UUID,
  heads: AggregateHeadReader
): RevisionExpectation {
  const head = heads.get(id);
  if (head === undefined || head.aggregateType !== aggregateType || head.spaceId !== spaceId) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Eine benötigte Referenz ist nicht im selben Bereich vorhanden.');
  }
  return { id, expectedRevision: head.revision };
}

function assertAggregateSpace(aggregate: P2Aggregate, spaceId: UUID, field: string): void {
  if (aggregate.spaceId !== spaceId) {
    throw new DomainValidationError('CROSS_SPACE_REFERENCE', `${field} gehört zu einem anderen Bereich.`);
  }
}

function assertUuid(value: unknown, field: string): asserts value is UUID {
  if (!uuidSchema.safeParse(value).success) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss eine UUID sein.`);
  }
}
