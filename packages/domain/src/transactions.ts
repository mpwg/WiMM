// SPDX-License-Identifier: AGPL-3.0-or-later
import { uuidSchema } from '@wimm/contracts';
import type { IsoDate, Money, UUID } from '@wimm/contracts';

import {
  createChangeSet,
  reviseAggregate,
  type AggregateHeadReader,
  type DomainChangeSet,
  type DomainDependencies,
  type FullCommandInput,
  type P2Aggregate
} from './commands.js';
import { parseFinanceDate } from './calendar.js';
import { DomainValidationError } from './errors.js';
import { assertMoney, sumMoney } from './money.js';

export const transactionKinds = ['normal', 'opening', 'transfer', 'contribution', 'settlement'] as const;
export type TransactionKind = (typeof transactionKinds)[number];
export const clearanceStates = ['uncleared', 'cleared', 'reconciled'] as const;
export type ClearanceState = (typeof clearanceStates)[number];

export interface TransactionSplit {
  readonly id: UUID;
  readonly categoryId: UUID;
  readonly amount: Money;
}

export interface TransactionFields {
  readonly accountId: UUID;
  readonly date: IsoDate;
  readonly amount: Money;
  readonly kind: TransactionKind;
  readonly payeeId?: UUID;
  readonly note?: string;
  readonly clearance: ClearanceState;
  readonly importReference?: string;
  readonly scheduleOccurrenceId?: UUID;
  readonly transferId?: UUID;
  readonly splits: readonly TransactionSplit[];
}

export type TransactionAggregate = P2Aggregate<'transaction', TransactionFields>;

export function saveTransaction(
  input: FullCommandInput<'transaction.save', TransactionAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'transaction.save', TransactionAggregate> {
  const transaction = normalizeTransaction(singleTransaction(input, 'transaction.save'));
  if (transaction.deletedAt !== undefined) {
    throw new DomainValidationError('INVALID_COMMAND', 'Eine gespeicherte Buchung darf kein Tombstone sein.');
  }
  if (transaction.clearance === 'reconciled') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden.'
    );
  }
  if (transaction.kind === 'transfer') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung geändert werden.'
    );
  }
  requireReferences(input, transaction, heads);
  return createChangeSet({ ...input, mutations: [{ aggregate: transaction }] }, heads, dependencies);
}

export function deleteTransaction(
  input: FullCommandInput<'transaction.delete', TransactionAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'transaction.delete', TransactionAggregate> {
  const transaction = normalizeTransaction(singleTransaction(input, 'transaction.delete'));
  if (transaction.clearance === 'reconciled') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Abgeglichene Buchungen müssen vor dem Löschen atomar entsperrt werden.'
    );
  }
  if (transaction.kind === 'transfer') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung gelöscht werden.'
    );
  }
  const tombstone = reviseAggregate({ ...transaction, deletedAt: transaction.updatedAt }, dependencies);
  requireReferences(input, tombstone, heads);
  return createChangeSet(
    { ...input, mutations: [{ aggregate: tombstone }] },
    heads,
    dependencies
  );
}

export function normalizeTransaction(transaction: TransactionAggregate): TransactionAggregate {
  if (transaction.aggregateType !== 'transaction') {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Buchung hat einen unpassenden Aggregattyp.');
  }
  assertUuid(transaction.accountId, 'Die Konto-ID');
  parseFinanceDate(transaction.date, 'Das Buchungsdatum');
  assertMoney(transaction.amount, 'Der Buchungsbetrag');
  if (!transactionKinds.includes(transaction.kind)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Buchungsart ist nicht bekannt.');
  }
  if (!clearanceStates.includes(transaction.clearance)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Abgleichstatus ist nicht bekannt.');
  }
  assertOptionalUuid(transaction.payeeId, 'Die Empfänger-ID');
  assertOptionalUuid(transaction.scheduleOccurrenceId, 'Die Dauerzahlungs-ID');
  assertOptionalUuid(transaction.transferId, 'Die Umbuchungs-ID');
  const note = normalizeOptionalText(transaction.note, 'Die Buchungsnotiz');
  const importReference = normalizeOptionalText(transaction.importReference, 'Die Importreferenz');
  const splits = normalizeSplits(transaction.splits);

  if (transaction.kind === 'normal') {
    if (splits.length === 0) {
      throw new DomainValidationError(
        'INVALID_AGGREGATE',
        'Normale Buchungen benötigen mindestens einen Split; nicht zugeordnete Buchungen verwenden die Systemkategorie.'
      );
    }
    if (sumMoney(splits.map((split) => split.amount), 'Die Splitsumme') !== transaction.amount) {
      throw new DomainValidationError('INVALID_AGGREGATE', 'Die Splitsumme muss exakt dem Buchungsbetrag entsprechen.');
    }
  } else if (splits.length !== 0) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Nur normale Buchungen dürfen kategorisierte Splits enthalten.'
    );
  }
  if (transaction.kind === 'opening' && transaction.transferId !== undefined) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Ein Anfangsbestand darf keine Umbuchung sein.');
  }
  if (transaction.kind === 'transfer' && transaction.transferId === undefined) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Eine Umbuchungsseite benötigt ihre Umbuchungs-ID.');
  }

  return {
    ...transaction,
    ...(note === undefined ? {} : { note }),
    ...(importReference === undefined ? {} : { importReference }),
    splits
  };
}

function requireReferences(
  input: FullCommandInput<'transaction.save' | 'transaction.delete', TransactionAggregate>,
  transaction: TransactionAggregate,
  heads: AggregateHeadReader
): void {
  requireExpectedHead(input, transaction.accountId, 'account', heads, 'Das Buchungskonto');
  for (const split of transaction.splits) {
    requireExpectedHead(input, split.categoryId, 'category', heads, 'Die Splitkategorie');
  }
  if (transaction.payeeId !== undefined) {
    requireExpectedHead(input, transaction.payeeId, 'payee', heads, 'Der Buchungsempfänger');
  }
}

function requireExpectedHead(
  input: FullCommandInput<'transaction.save' | 'transaction.delete', TransactionAggregate>,
  id: UUID,
  aggregateType: 'account' | 'category' | 'payee',
  heads: AggregateHeadReader,
  field: string
): void {
  if (!input.expectedRevisions.some((expectation) => expectation.id === id)) {
    throw new DomainValidationError('REVISION_MISSING', `${field} benötigt eine erwartete Revision.`);
  }
  const head = heads.get(id);
  if (head === undefined || head.aggregateType !== aggregateType) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} ist nicht als passendes Aggregat vorhanden.`);
  }
}

function normalizeSplits(splits: readonly TransactionSplit[]): readonly TransactionSplit[] {
  if (!Array.isArray(splits)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Buchungssplits müssen vollständig angegeben werden.');
  }
  const ids = new Set<UUID>();
  return Object.freeze(
    splits.map((split: TransactionSplit) => {
      assertUuid(split.id, 'Die Split-ID');
      assertUuid(split.categoryId, 'Die Splitkategorie-ID');
      assertMoney(split.amount, 'Der Splitbetrag');
      if (ids.has(split.id)) {
        throw new DomainValidationError('DUPLICATE_REFERENCE', 'Eine Split-ID darf nur einmal vorkommen.');
      }
      ids.add(split.id);
      return Object.freeze({ ...split });
    })
  );
}

function singleTransaction<TCommandType extends 'transaction.save' | 'transaction.delete'>(
  input: FullCommandInput<TCommandType, TransactionAggregate>,
  commandType: TCommandType
): TransactionAggregate {
  if (input.commandType !== commandType || input.mutations.length !== 1) {
    throw new DomainValidationError('INVALID_COMMAND', 'Der Buchungsbefehl benötigt genau eine vollständige Buchung.');
  }
  return input.mutations[0]!.aggregate;
}

function assertUuid(value: unknown, field: string): asserts value is UUID {
  if (!uuidSchema.safeParse(value).success) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss eine UUID sein.`);
  }
}

function assertOptionalUuid(value: unknown, field: string): void {
  if (value !== undefined) {
    assertUuid(value, field);
  }
}

function normalizeOptionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss Text enthalten.`);
  }
  const normalized = value.normalize('NFC').trim();
  return normalized.length === 0 ? undefined : normalized;
}
