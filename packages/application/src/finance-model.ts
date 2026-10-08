// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import { createAggregateMetadata, parseFinanceDate, parseMoney, parseDirectedMoney, reviseAggregate, subtractMoney, archiveAccount, archiveCategory, mergePayees, saveTransfer, confirmReconciliation, reconciliationDifference, unlockFinanceSelection, deleteTransfer, saveTransaction, deleteTransaction, createAccountWithOpening, saveCategory, saveCategoryGroup, savePayee, type AccountAggregate, type CategoryAggregate, type CategoryGroupAggregate, type DomainChangeSet, type DomainDependencies, type PayeeAggregate, type P2Aggregate, type TransactionAggregate, type TransferAggregate, type ReconciliationAggregate } from '@wimm/domain';
import type { StoredAggregate } from '@wimm/storage';
export interface TransactionInput {
  readonly direction?: 'expense' | 'income'; readonly accountId: UUID; readonly payeeId?: UUID; readonly amount: string; readonly date: string; readonly note: string; readonly opening: boolean;
  readonly splits: readonly { readonly id?: UUID; readonly categoryId: UUID; readonly amount: string }[];
}

export class FinanceModel {
  list(spaceId: UUID) { return [...this.heads.values()].filter(a => a.spaceId === spaceId); }
  get allAggregates() { return [...this.heads.values()]; }
  get activeSpaceId() { return this.spaceId; }
  async commitAutomation(change: DomainChangeSet) { await this.execute(change); }
  readonly allAccounts: readonly AccountAggregate[];
  readonly accounts: readonly AccountAggregate[];
  readonly allCategories: readonly CategoryAggregate[];
  readonly categories: readonly CategoryAggregate[];
  readonly groups: readonly CategoryGroupAggregate[];
  readonly allPayees: readonly PayeeAggregate[];
  readonly payees: readonly PayeeAggregate[];
  readonly transactions: readonly TransactionAggregate[];
  readonly orderedTransactions: readonly TransactionAggregate[];
  private readonly heads = new Map<UUID, P2Aggregate>();
  constructor(private readonly spaceId: UUID, aggregates: readonly StoredAggregate[], private readonly execute: (changeSet: DomainChangeSet) => Promise<void>, readonly domainDependencies: DomainDependencies) {
    aggregates.forEach((aggregate) => this.heads.set(aggregate.id, aggregate));
    this.allAccounts = aggregates.filter((aggregate): aggregate is StoredAggregate & AccountAggregate => aggregate.aggregateType === 'account' && aggregate.deletedAt === undefined);
    this.accounts = this.allAccounts.filter((account) => !account.archived);
    this.allCategories = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryAggregate => aggregate.aggregateType === 'category' && aggregate.deletedAt === undefined);
    this.categories = this.allCategories.filter((category) => !category.archived);
    this.groups = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryGroupAggregate => aggregate.aggregateType === 'categoryGroup' && aggregate.deletedAt === undefined);
    this.allPayees = aggregates.filter((aggregate): aggregate is StoredAggregate & PayeeAggregate => aggregate.aggregateType === 'payee' && aggregate.deletedAt === undefined);
    this.payees = this.allPayees.filter((payee) => !payee.archived);
    this.transactions = aggregates.filter((aggregate): aggregate is StoredAggregate & TransactionAggregate => aggregate.aggregateType === 'transaction' && aggregate.deletedAt === undefined);
    this.orderedTransactions = Object.freeze(this.transactions.toSorted((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id)));
  }
  async addAccount(name: string, type: AccountAggregate['type'], onBudget: boolean, opening?: { amount: string; date: string }) {
    const aggregate: AccountAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'account', name, type, onBudget, archived: false };
    await this.execute(createAccountWithOpening(aggregate, opening, this, this.domainDependencies));
  }
  async addGroup(name: string, kind: CategoryGroupAggregate['kind']) {
    const aggregate: CategoryGroupAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'categoryGroup', name, kind, sortOrder: this.groups.length, archived: false };
    await this.execute(saveCategoryGroup({ commandType: 'categoryGroup.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async addCategory(name: string, groupId: UUID) {
    const group = this.groups.find((entry) => entry.id === groupId); if (group === undefined) throw new TypeError('Bitte zuerst eine Kategoriegruppe anlegen.');
    const aggregate: CategoryAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'category', groupId, name, sortOrder: this.categories.filter((entry) => entry.groupId === groupId).length, archived: false };
    await this.execute(saveCategory({ commandType: 'category.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }, { id: group.id, expectedRevision: group.revision }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async addPayee(name: string) {
    const aggregate: PayeeAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'payee', name, aliases: [], archived: false };
    await this.execute(savePayee({ commandType: 'payee.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async archiveAccount(id: UUID) {
    const account = this.accounts.find((entry) => entry.id === id);
    if (account === undefined) throw new TypeError('Dieses Konto ist nicht mehr aktiv.');
    const archived = reviseAggregate({ ...account, archived: true }, this.domainDependencies);
    await this.execute(archiveAccount({
      commandType: 'account.archive',
      spaceId: this.spaceId,
      expectedRevisions: [{ id: account.id, expectedRevision: account.revision }],
      mutations: [{ aggregate: archived }]
    }, this, this.domainDependencies));
  }
  async archiveCategory(id: UUID) {
    const category = this.categories.find((entry) => entry.id === id);
    if (category === undefined) throw new TypeError('Diese Kategorie ist nicht mehr aktiv.');
    const group = this.groups.find((entry) => entry.id === category.groupId);
    if (group === undefined) throw new TypeError('Die Kategoriegruppe ist nicht mehr verfügbar.');
    const archived = reviseAggregate({ ...category, archived: true }, this.domainDependencies);
    await this.execute(archiveCategory({
      commandType: 'category.archive',
      spaceId: this.spaceId,
      expectedRevisions: [
        { id: category.id, expectedRevision: category.revision },
        { id: group.id, expectedRevision: group.revision }
      ],
      mutations: [{ aggregate: archived }]
    }, this, this.domainDependencies));
  }
  async mergePayees(targetId: UUID, sourceId: UUID) {
    const target = this.payees.find((entry) => entry.id === targetId);
    const source = this.payees.find((entry) => entry.id === sourceId);
    if (target === undefined || source === undefined || target.id === source.id) {
      throw new TypeError('Bitte wählen Sie zwei verschiedene aktive Empfänger.');
    }
    await this.execute(mergePayees({
      spaceId: this.spaceId,
      target,
      sources: [source],
      transactions: this.transactions.filter((transaction) => transaction.payeeId === source.id)
    }, this, this.domainDependencies));
  }
  async storeTransaction(input: TransactionInput, previous?: TransactionAggregate) {
    const amount = input.direction === undefined ? parseMoney(input.amount, 'Der Betrag') : parseDirectedMoney(input.amount, input.direction);
    const splits = input.opening ? [] : input.splits.map((split, index) => ({
      id: split.id ?? this.domainDependencies.ids.next(), categoryId: split.categoryId,
      amount: input.direction !== undefined && input.splits.length === 1 ? amount : input.direction === undefined || /^[+-]/.test(split.amount) ? parseMoney(split.amount, `Der Splitbetrag ${index + 1}`) : parseDirectedMoney(split.amount, input.direction, `Der Splitbetrag ${index + 1}`)
    }));
    // Die geöffnete Revision bleibt erhalten, auch wenn sich der Listenstand ändert.
    const metadata = previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(previous, this.domainDependencies);
    const { payeeId: _oldPayee, note: _oldNote, ...base } = metadata as TransactionAggregate;
    const aggregate: TransactionAggregate = {
      ...base, aggregateType: 'transaction', accountId: input.accountId, date: parseFinanceDate(input.date), amount,
      kind: input.opening ? 'opening' : 'normal', clearance: previous?.clearance ?? 'uncleared',
      ...(input.payeeId === undefined ? {} : { payeeId: input.payeeId }),
      ...(input.note.trim() === '' ? {} : { note: input.note.trim() }), splits
    };
    await this.execute(saveTransaction({ commandType: 'transaction.save', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(aggregate, previous?.revision ?? 0), mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async removeTransaction(transaction: TransactionAggregate) {
    await this.execute(deleteTransaction({ commandType: 'transaction.delete', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(transaction, transaction.revision), mutations: [{ aggregate: transaction }] }, this, this.domainDependencies));
  }
  private transactionRevisions(transaction: TransactionAggregate, revision: number) {
    return [{ id: transaction.id, expectedRevision: revision },
      ...[...new Set([transaction.accountId, ...transaction.splits.map((split) => split.categoryId), ...(transaction.payeeId === undefined ? [] : [transaction.payeeId])])]
        .map((id) => { const head = this.heads.get(id); if (head === undefined) throw new TypeError('Eine Buchungsreferenz ist nicht mehr verfügbar.'); return { id, expectedRevision: head.revision }; })];
  }
  async addTransfer(sourceAccountId: UUID, targetAccountId: UUID, value: string, date: string, budgetCategoryId?: UUID, budgetRelease = false, previous?: TransferAggregate) {
    const amount = parseMoney(value, 'Der Umbuchungsbetrag');
    const sourceAccount = this.accounts.find((account) => account.id === sourceAccountId); const targetAccount = this.accounts.find((account) => account.id === targetAccountId);
    if (sourceAccount === undefined || targetAccount === undefined) throw new TypeError('Quell- und Zielkonto müssen ausgewählt werden.');
    const { budgetCategoryId: _oldCategory, budgetRelease: _oldRelease, ...metadata } = previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) as TransferAggregate : reviseAggregate(previous, this.domainDependencies);
    const transfer: TransferAggregate = { ...metadata, aggregateType: 'transfer', date: parseFinanceDate(date), sourceAccountId, targetAccountId, sourceTransactionId: previous?.sourceTransactionId ?? this.domainDependencies.ids.next(), targetTransactionId: previous?.targetTransactionId ?? this.domainDependencies.ids.next(), amount, ...(budgetCategoryId === undefined ? {} : { budgetCategoryId }), ...(budgetRelease ? { budgetRelease: true } : {}) };
    const source: TransactionAggregate = { ...(previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(this.heads.get(previous.sourceTransactionId) as TransactionAggregate, this.domainDependencies)), id: transfer.sourceTransactionId, aggregateType: 'transaction', accountId: sourceAccountId, date: transfer.date, amount: subtractMoney(0 as never, amount), kind: 'transfer', clearance: previous === undefined ? 'uncleared' : (this.heads.get(transfer.sourceTransactionId) as TransactionAggregate).clearance, transferId: transfer.id, splits: [] };
    const target: TransactionAggregate = { ...(previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(this.heads.get(previous.targetTransactionId) as TransactionAggregate, this.domainDependencies)), id: transfer.targetTransactionId, aggregateType: 'transaction', accountId: targetAccountId, date: transfer.date, amount, kind: 'transfer', clearance: previous === undefined ? 'uncleared' : (this.heads.get(transfer.targetTransactionId) as TransactionAggregate).clearance, transferId: transfer.id, splits: [] };
    await this.execute(saveTransfer({ spaceId: this.spaceId, transfer, source, target, sourceAccount, targetAccount, ...this.budgetReferences(transfer) }, this, this.domainDependencies));
  }
  private budgetReferences(transfer: TransferAggregate) {
    const budgetCategory = this.allCategories.find((entry) => entry.id === transfer.budgetCategoryId);
    const budgetGroup = this.groups.find((entry) => entry.id === budgetCategory?.groupId);
    return { ...(budgetCategory === undefined ? {} : { budgetCategory }), ...(budgetGroup === undefined ? {} : { budgetGroup }) };
  }
  transferFor(transaction: TransactionAggregate) {
    if (transaction.kind !== 'transfer') return undefined;
    const transfer = this.heads.get(transaction.transferId!) as TransferAggregate | undefined;
    const source = transfer === undefined ? undefined : this.heads.get(transfer.sourceTransactionId) as TransactionAggregate | undefined;
    const target = transfer === undefined ? undefined : this.heads.get(transfer.targetTransactionId) as TransactionAggregate | undefined;
    if (transfer?.aggregateType !== 'transfer' || transfer.deletedAt !== undefined || source?.aggregateType !== 'transaction' || target?.aggregateType !== 'transaction' || source.deletedAt !== undefined || target.deletedAt !== undefined || source.kind !== 'transfer' || target.kind !== 'transfer' || source.transferId !== transfer.id || target.transferId !== transfer.id || source.accountId !== transfer.sourceAccountId || target.accountId !== transfer.targetAccountId || source.date !== transfer.date || target.date !== transfer.date || source.amount !== subtractMoney(0, transfer.amount) || target.amount !== transfer.amount || ![source.id, target.id].includes(transaction.id)) throw new TypeError('Die vollständige vorhandene Umbuchung fehlt oder ist ungültig. Bitte öffnen Sie den aktuellen Stand erneut.');
    return transfer;
  }
  async removeTransfer(transfer: TransferAggregate) {
    await this.execute(deleteTransfer({ spaceId: this.spaceId, transfer, source: this.heads.get(transfer.sourceTransactionId) as TransactionAggregate, target: this.heads.get(transfer.targetTransactionId) as TransactionAggregate, sourceAccount: this.heads.get(transfer.sourceAccountId) as AccountAggregate, targetAccount: this.heads.get(transfer.targetAccountId) as AccountAggregate, ...this.budgetReferences(transfer) }, this, this.domainDependencies));
  }
  async unlock(transaction: TransactionAggregate) {
    if (this.heads.get(transaction.id)?.revision !== transaction.revision) throw new Error('REVISION_CONFLICT: Die Buchung wurde inzwischen geändert.');
    await this.execute(unlockFinanceSelection(this.spaceId, transaction.id, [...this.heads.values()], this.domainDependencies));
  }
  reconciliationInput(accountId: UUID, value: string, date: string, ids: readonly UUID[]) {
    const transactions = ids.map((id) => {
      const transaction = this.transactions.find((entry) => entry.id === id);
      if (transaction === undefined || transaction.clearance === 'reconciled') throw new TypeError('Eine ausgewählte Buchung ist nicht mehr für den Abgleich verfügbar.');
      return transaction;
    });
    const reconciliation: ReconciliationAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'reconciliation', accountId, statementDate: parseFinanceDate(date), statementBalance: parseMoney(value, 'Der Auszugssaldo'), transactionIds: [...ids] };
    return { spaceId: this.spaceId, reconciliation, transactions, previousTransactions: this.transactions.filter((transaction) => transaction.accountId === accountId && transaction.clearance === 'reconciled' && transaction.date <= date) };
  }
  difference(accountId: UUID, value: string, date: string, ids: readonly UUID[]) { return reconciliationDifference(this.reconciliationInput(accountId, value, date, ids)); }
  async reconcile(accountId: UUID, value: string, date: string, ids: readonly UUID[]) {
    const result = confirmReconciliation(this.reconciliationInput(accountId, value, date, ids), this, this.domainDependencies);
    await this.execute(result.changeSet);
  }
  get(id: UUID) { const aggregate = this.heads.get(id); return aggregate === undefined ? undefined : { id: aggregate.id, spaceId: aggregate.spaceId, revision: aggregate.revision, aggregateType: aggregate.aggregateType }; }
}
