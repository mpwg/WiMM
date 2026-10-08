// SPDX-License-Identifier: AGPL-3.0-or-later
import { accountBalancePayloadSchema, consumptionPayloadSchema, financialAggregateSchema, moneySchema, yearMonthSchema } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';
import type { P2Aggregate, P2AggregateType } from './commands.js';
import { DomainValidationError } from './errors.js';
import { normalizeAccount, normalizeCategory, normalizeCategoryGroup, normalizePayee, type AccountAggregate, type CategoryAggregate, type CategoryGroupAggregate, type PayeeAggregate } from './master-data.js';
import { normalizeTransaction, type TransactionAggregate } from './transactions.js';
import { normalizeReconciliation, validateTransferPair, type ReconciliationAggregate, type TransferAggregate } from './transfers.js';
import { dueDates, validateImportBatchStructure, validateRuleStructure, type ImportBatchAggregate, type ImportFingerprintAggregate, type OccurrenceAggregate, type RuleAggregate, type ScheduleAggregate } from './automation.js';
import { rebuildFinancialProjections, projectConsumption } from './projections.js';
import { sumMoney } from './money.js';

function invalid(): never { throw new DomainValidationError('INVALID_AGGREGATE', 'Der Finanzbestand ist unvollständig oder widerspricht dem Fachvertrag.'); }

/** Prüft einen vollständigen gespeicherten Bestand; historische Ziele dürfen Tombstones sein. */
export function validateFinancialState(aggregates: readonly P2Aggregate[], spaceId: UUID): void {
  const byId = new Map<UUID, P2Aggregate>();
  for (const aggregate of aggregates) {
    if (!financialAggregateSchema.safeParse(aggregate).success || aggregate.spaceId !== spaceId || byId.has(aggregate.id) || aggregate.updatedAt < aggregate.createdAt || (aggregate.deletedAt !== undefined && aggregate.deletedAt < aggregate.createdAt) || ((aggregate.id === spaceId) !== (aggregate.aggregateType === 'financialRevision'))) invalid();
    byId.set(aggregate.id, aggregate);
  }
  const target = <T extends P2Aggregate>(id: UUID, type: P2AggregateType): T => {
    const aggregate = byId.get(id);
    if (aggregate === undefined || aggregate.aggregateType !== type) invalid();
    return aggregate as T;
  };
  const reconciled = new Map<UUID, UUID>();
  let systemCategories = 0;
  for (const aggregate of aggregates) {
    switch (aggregate.aggregateType) {
      case 'account': normalizeAccount(aggregate as AccountAggregate); break;
      case 'categoryGroup': normalizeCategoryGroup(aggregate as CategoryGroupAggregate); break;
      case 'category': {
        const category = normalizeCategory(aggregate as CategoryAggregate);
        target(category.groupId, 'categoryGroup');
        if (category.system !== undefined && (category.archived || category.deletedAt !== undefined || ++systemCategories > 1)) invalid();
        break;
      }
      case 'payee': normalizePayee(aggregate as PayeeAggregate); break;
      case 'transaction': {
        const transaction = normalizeTransaction(aggregate as TransactionAggregate);
        target(transaction.accountId, 'account');
        if (transaction.payeeId !== undefined) target(transaction.payeeId, 'payee');
        for (const split of transaction.splits) target(split.categoryId, 'category');
        if (transaction.transferId !== undefined) {
          const transfer = target<TransferAggregate>(transaction.transferId, 'transfer');
          if (transaction.kind !== 'transfer' || ![transfer.sourceTransactionId, transfer.targetTransactionId].includes(transaction.id)) invalid();
        }
        if (transaction.scheduleOccurrenceId !== undefined) {
          const occurrence = target<OccurrenceAggregate>(transaction.scheduleOccurrenceId, 'scheduleOccurrence');
          if (occurrence.transactionId !== transaction.id || occurrence.state !== 'confirmed') invalid();
        }
        break;
      }
      case 'transfer': {
        const transfer = aggregate as TransferAggregate;
        target(transfer.sourceAccountId, 'account'); target(transfer.targetAccountId, 'account');
        const source = target<TransactionAggregate>(transfer.sourceTransactionId, 'transaction');
        const destination = target<TransactionAggregate>(transfer.targetTransactionId, 'transaction');
        validateTransferPair({ spaceId, transfer, source, target: destination });
        if ((transfer.deletedAt === undefined) !== (source.deletedAt === undefined) || (transfer.deletedAt === undefined) !== (destination.deletedAt === undefined)) invalid();
        if (transfer.budgetCategoryId !== undefined) {
          const category = target<CategoryAggregate>(transfer.budgetCategoryId, 'category');
          if (target<CategoryGroupAggregate>(category.groupId, 'categoryGroup').kind !== 'expense') invalid();
        }
        break;
      }
      case 'reconciliation': {
        const reconciliation = normalizeReconciliation(aggregate as ReconciliationAggregate);
        target(reconciliation.accountId, 'account');
        for (const id of reconciliation.transactionIds) {
          const transaction = target<TransactionAggregate>(id, 'transaction');
          if (reconciliation.deletedAt === undefined) {
            if (transaction.deletedAt !== undefined || transaction.accountId !== reconciliation.accountId || transaction.date > reconciliation.statementDate || transaction.clearance !== 'reconciled' || reconciled.has(id)) invalid();
            reconciled.set(id, reconciliation.id);
          }
        }
        break;
      }
      case 'importBatch': {
        const batch = aggregate as ImportBatchAggregate;
        validateImportBatchStructure(batch); target(batch.accountId, 'account');
        for (const row of batch.rows) {
          if (row.candidate?.categoryId !== undefined) target(row.candidate.categoryId, 'category');
          if (row.candidate?.payeeId !== undefined) target(row.candidate.payeeId, 'payee');
        }
        break;
      }
      case 'importFingerprint': {
        const fingerprint = aggregate as ImportFingerprintAggregate;
        target(fingerprint.accountId, 'account');
        target(fingerprint.transactionId, 'transaction');
        const batch = target<ImportBatchAggregate>(fingerprint.importId, 'importBatch');
        if (batch.accountId !== fingerprint.accountId || !batch.committedRows.includes(fingerprint.sourceRow)) invalid();
        break;
      }
      case 'rule': {
        const rule = aggregate as RuleAggregate; validateRuleStructure(rule);
        for (const action of rule.actions) if (action.field !== 'clearance') target(action.value, action.field === 'categoryId' ? 'category' : 'payee');
        break;
      }
      case 'schedule': {
        const schedule = aggregate as ScheduleAggregate;
        dueDates({ ...schedule, enabled: true }, schedule.startDate);
        const template = normalizeTransaction({ ...schedule, aggregateType: 'transaction', ...schedule.template, date: schedule.startDate });
        if (template.kind !== 'normal' || template.clearance === 'reconciled' || template.transferId !== undefined) invalid();
        target(template.accountId, 'account');
        if (template.payeeId !== undefined) target(template.payeeId, 'payee');
        for (const split of template.splits) target(split.categoryId, 'category');
        break;
      }
      case 'scheduleOccurrence': {
        const occurrence = aggregate as OccurrenceAggregate;
        target(occurrence.scheduleId, 'schedule');
        if (occurrence.state === 'confirmed') {
          if (occurrence.transactionId === undefined) invalid();
          const transaction = target<TransactionAggregate>(occurrence.transactionId, 'transaction');
          if (transaction.scheduleOccurrenceId !== occurrence.id) invalid();
        } else if (occurrence.transactionId !== undefined) invalid();
        break;
      }
      default: break;
    }
  }
  const transactions = aggregates.filter((entry): entry is TransactionAggregate => entry.aggregateType === 'transaction');
  for (const transaction of transactions) if (transaction.deletedAt === undefined && transaction.clearance === 'reconciled' && !reconciled.has(transaction.id)) invalid();
  const categories = aggregates.filter((entry): entry is CategoryAggregate => entry.aggregateType === 'category');
  const groups = aggregates.filter((entry): entry is CategoryGroupAggregate => entry.aggregateType === 'categoryGroup');
  const projections = rebuildFinancialProjections({ transactions, categories, categoryGroups: groups });
  sumMoney(projections.accountBalances.map((entry) => entry.balance), 'Der Gesamtkontostand');
  const months = new Map<string, TransactionAggregate[]>();
  for (const transaction of transactions.filter((entry) => entry.deletedAt === undefined)) {
    const key = transaction.date.slice(0, 7); const month = months.get(key) ?? []; month.push(transaction); months.set(key, month);
  }
  for (const month of months.values()) { sumMoney(month.map((entry) => entry.amount), 'Die Monatssumme'); projectConsumption(month, categories, groups); }
}

/** Snapshotcaches dürfen nur dieselben Fachwerte wie ihr vollständiger Ausgangsbestand tragen. */
export function validateFinancialProjectionCache(aggregates: readonly P2Aggregate[], projections: readonly { kind: string; key: string; payload: unknown }[]): void {
  const transactions = aggregates.filter((entry): entry is TransactionAggregate => entry.aggregateType === 'transaction');
  const categories = aggregates.filter((entry): entry is CategoryAggregate => entry.aggregateType === 'category');
  const groups = aggregates.filter((entry): entry is CategoryGroupAggregate => entry.aggregateType === 'categoryGroup');
  const all = rebuildFinancialProjections({ transactions, categories, categoryGroups: groups });
  const balances = new Map(all.accountBalances.map((entry) => [entry.accountId, entry.balance]));
  const accounts = new Set(aggregates.filter((entry) => entry.aggregateType === 'account').map((entry) => entry.id));
  for (const projection of projections) {
    if (projection.kind === 'balance' || projection.kind === 'accountBalance') {
      if (!accounts.has(projection.key)) invalid();
      if (projection.kind === 'balance') {
        const parsed = moneySchema.safeParse(projection.payload);
        if (!parsed.success || parsed.data !== (balances.get(projection.key) ?? 0)) invalid();
      } else {
        const parsed = accountBalancePayloadSchema.safeParse(projection.payload);
        if (!parsed.success || parsed.data.balance !== (balances.get(projection.key) ?? 0) || (parsed.data.accountId !== undefined && parsed.data.accountId !== projection.key)) invalid();
      }
    } else if (projection.kind === 'consumption') {
      const parsed = consumptionPayloadSchema.safeParse(projection.payload);
      if (!parsed.success || (projection.key !== 'all' && !yearMonthSchema.safeParse(projection.key).success)) invalid();
      const expected = projection.key === 'all' ? all.consumption : projectConsumption(transactions.filter((entry) => entry.date.slice(0, 7) === projection.key), categories, groups);
      const actual = parsed.data;
      if (actual.income !== expected.income || actual.expense !== expected.expense || actual.net !== expected.net || actual.categories.length !== expected.categories.length || new Set(actual.categories.map((entry) => entry.categoryId)).size !== actual.categories.length) invalid();
      const byId = new Map(expected.categories.map((entry) => [entry.categoryId, entry]));
      if (actual.categories.some((entry) => entry.amount !== byId.get(entry.categoryId)?.amount || entry.groupKind !== byId.get(entry.categoryId)?.groupKind)) invalid();
    } else invalid();
  }
}
