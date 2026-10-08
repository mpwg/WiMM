// SPDX-License-Identifier: AGPL-3.0-or-later
import { uuidSchema } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';

import {
  createChangeSet,
  reviseAggregate,
  type AggregateHeadReader,
  type AggregateMetadata,
  type DomainChangeSet,
  type DomainDependencies,
  type FullCommandInput,
  type P2Aggregate,
  type RevisionExpectation
} from './commands.js';
import { DomainValidationError } from './errors.js';
import type { TransactionAggregate } from './transactions.js';
import { validateFinancialReferences } from './financial-references.js';

export const accountTypes = ['checking', 'cash', 'savings', 'credit', 'other'] as const;
export type AccountType = (typeof accountTypes)[number];

export const categoryGroupKinds = ['income', 'expense'] as const;
export type CategoryGroupKind = (typeof categoryGroupKinds)[number];

export interface AccountFields {
  readonly name: string;
  readonly type: AccountType;
  readonly onBudget: boolean;
  readonly archived: boolean;
}

export type AccountAggregate = P2Aggregate<'account', AccountFields>;

export interface CategoryGroupFields {
  readonly name: string;
  readonly kind: CategoryGroupKind;
  readonly sortOrder: number;
  readonly archived: boolean;
}

export type CategoryGroupAggregate = P2Aggregate<'categoryGroup', CategoryGroupFields>;

export interface CategoryFields {
  readonly groupId: UUID;
  readonly name: string;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly system?: 'uncategorized';
}

export type CategoryAggregate = P2Aggregate<'category', CategoryFields>;

export interface PayeeFields {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly archived: boolean;
}

export type PayeeAggregate = P2Aggregate<'payee', PayeeFields>;

/** Vollständige Transaktion, die für eine Empfängerzusammenführung nur über ihre Referenz betrachtet wird. */
export type PayeeTransactionReference = P2Aggregate<'transaction', { readonly payeeId?: UUID; readonly clearance: 'uncleared' | 'cleared' | 'reconciled' }>;

export function saveAccount(
  input: FullCommandInput<'account.save', AccountAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'account.save', AccountAggregate> {
  const account = normalizeAccount(singleMutation(input, 'account.save'));
  return createChangeSet({ ...input, mutations: [{ aggregate: account }] }, heads, dependencies);
}

export function archiveAccount(
  input: FullCommandInput<'account.archive', AccountAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'account.archive', AccountAggregate> {
  const account = normalizeAccount(singleMutation(input, 'account.archive'));
  if (!account.archived) {
    throw new DomainValidationError('INVALID_COMMAND', 'Ein archiviertes Konto muss als archiviert markiert sein.');
  }
  return createChangeSet({ ...input, mutations: [{ aggregate: account }] }, heads, dependencies);
}

export function saveCategoryGroup(
  input: FullCommandInput<'categoryGroup.save', CategoryGroupAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'categoryGroup.save', CategoryGroupAggregate> {
  const group = normalizeCategoryGroup(singleMutation(input, 'categoryGroup.save'));
  return createChangeSet({ ...input, mutations: [{ aggregate: group }] }, heads, dependencies);
}

export function saveCategory(
  input: FullCommandInput<'category.save', CategoryAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'category.save', CategoryAggregate> {
  const category = normalizeCategory(singleMutation(input, 'category.save'));
  requireCategoryGroupRevision(input.expectedRevisions, category.groupId, heads);
  assertCategorySystemStatus(category, input.spaceId, heads);
  return createChangeSet({ ...input, mutations: [{ aggregate: category }] }, heads, dependencies);
}

export function archiveCategory(
  input: FullCommandInput<'category.archive', CategoryAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'category.archive', CategoryAggregate> {
  const category = normalizeCategory(singleMutation(input, 'category.archive'));
  assertCategorySystemStatus(category, input.spaceId, heads);
  if (!category.archived) {
    throw new DomainValidationError('INVALID_COMMAND', 'Eine archivierte Kategorie muss als archiviert markiert sein.');
  }
  if (category.system === 'uncategorized') {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Die Systemkategorie „Nicht zugeordnet“ darf nicht archiviert werden.'
    );
  }
  requireCategoryGroupRevision(input.expectedRevisions, category.groupId, heads);
  return createChangeSet({ ...input, mutations: [{ aggregate: category }] }, heads, dependencies);
}

function assertCategorySystemStatus(category: CategoryAggregate, spaceId: UUID, heads: AggregateHeadReader): void {
  if (heads.list === undefined) {
    throw new DomainValidationError('INVALID_COMMAND', 'Kategorieänderungen benötigen den vollständigen aktuellen Fachbestand.');
  }
  const currentAggregates = heads.list(spaceId);
  validateFinancialReferences([category], currentAggregates);
  const current = currentAggregates.find((aggregate) => aggregate.id === category.id);
  const stored = current?.aggregateType === 'category' ? current as CategoryAggregate : undefined;
  if (stored?.system === 'uncategorized') {
    if (category.system !== 'uncategorized' || category.archived || category.deletedAt !== undefined) {
      throw new DomainValidationError('INVALID_COMMAND', 'Die Systemkategorie „Nicht zugeordnet“ darf weder umgewidmet noch archiviert oder gelöscht werden.');
    }
  } else if (stored !== undefined && category.system !== stored.system) {
    throw new DomainValidationError('INVALID_COMMAND', 'Der Systemstatus einer gespeicherten Kategorie darf nicht geändert werden.');
  }
}

/** Erstellt die unveränderliche Systemkategorie für noch nicht zugeordnete normale Buchungen. */
export function createUncategorizedCategory(
  metadata: AggregateMetadata,
  groupId: UUID,
  sortOrder = 0
): CategoryAggregate {
  assertUuid(groupId, 'Die Kategoriegruppen-ID der Systemkategorie');
  assertSortOrder(sortOrder);
  return Object.freeze({
    ...metadata,
    aggregateType: 'category',
    groupId,
    name: 'Nicht zugeordnet',
    sortOrder,
    archived: false,
    system: 'uncategorized'
  });
}

export function savePayee(
  input: FullCommandInput<'payee.save', PayeeAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'payee.save', PayeeAggregate> {
  const payee = normalizePayee(singleMutation(input, 'payee.save'));
  return createChangeSet({ ...input, mutations: [{ aggregate: payee }] }, heads, dependencies);
}

export interface PayeeMergeInput {
  readonly spaceId: UUID;
  readonly target: PayeeAggregate;
  readonly sources: readonly PayeeAggregate[];
  readonly transactions: readonly PayeeTransactionReference[];
}

/**
 * Führt Empfänger und sämtliche aktiven gespeicherten Transaktionsreferenzen in einer
 * Änderungsmenge zusammen. Alle Quellen werden archiviert, nie gelöscht.
 */
export function mergePayees(
  input: PayeeMergeInput,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<'payee.merge', P2Aggregate> {
  assertUuid(input.spaceId, 'Die Bereichs-ID der Empfängerzusammenführung');
  const target = normalizePayee(input.target);
  if (target.spaceId !== input.spaceId || target.archived || target.deletedAt !== undefined) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Der Ziel-Empfänger muss aktiv sein und zum selben Bereich gehören.'
    );
  }
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Eine Empfängerzusammenführung benötigt mindestens einen Quell-Empfänger.'
    );
  }
  if (!Array.isArray(input.transactions)) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Die Empfängerreferenzen müssen vollständig angegeben werden.'
    );
  }

  const sourceIds = new Set<UUID>();
  const sources = input.sources.map((source: PayeeAggregate) => {
    const normalized = normalizePayee(source);
    if (normalized.spaceId !== input.spaceId || normalized.id === target.id || normalized.archived || normalized.deletedAt !== undefined) {
      throw new DomainValidationError(
        'INVALID_COMMAND',
        'Quell-Empfänger müssen aktiv, verschieden vom Ziel und im selben Bereich sein.'
      );
    }
    if (sourceIds.has(normalized.id)) {
      throw new DomainValidationError(
        'DUPLICATE_REFERENCE',
        'Ein Quell-Empfänger darf nur einmal zusammengeführt werden.'
      );
    }
    sourceIds.add(normalized.id);
    return normalized;
  });

  if (heads.list === undefined) {
    throw new DomainValidationError('INVALID_COMMAND', 'Empfängerzusammenführungen benötigen den vollständigen aktuellen Fachbestand.');
  }
  const current = heads.list(input.spaceId);
  if (current.some((aggregate) => aggregate.spaceId !== input.spaceId) || new Set(current.map((aggregate) => aggregate.id)).size !== current.length) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Fachbestand für die Empfängerzusammenführung ist nicht eindeutig im aktuellen Bereich.');
  }
  for (const payee of [target, ...sources]) {
    if (current.find((aggregate) => aggregate.id === payee.id)?.deletedAt !== undefined) {
      throw new DomainValidationError('INVALID_AGGREGATE', 'Gelöschte Empfänger dürfen nicht zusammengeführt oder neu referenziert werden.');
    }
  }
  const currentTransactions = current.filter((aggregate): aggregate is TransactionAggregate => {
    if (aggregate.aggregateType !== 'transaction' || aggregate.deletedAt !== undefined) return false;
    const transaction = aggregate as TransactionAggregate;
    return transaction.payeeId !== undefined && sourceIds.has(transaction.payeeId);
  });

  const transactionIds = new Set<UUID>();
  const suppliedById = new Map<UUID, PayeeTransactionReference>();
  input.transactions.forEach((transaction: PayeeTransactionReference) => {
    assertPayeeTransactionReference(transaction);
    if (transaction.spaceId !== input.spaceId || transaction.payeeId === undefined || !sourceIds.has(transaction.payeeId)) {
      throw new DomainValidationError(
        'INVALID_COMMAND',
        'Jede übergebene Transaktion muss einen Quell-Empfänger desselben Bereichs referenzieren.'
      );
    }
    if (transactionIds.has(transaction.id)) {
      throw new DomainValidationError(
        'DUPLICATE_REFERENCE',
        'Eine Transaktionsreferenz darf nur einmal zusammengeführt werden.'
      );
    }
    if (transaction.clearance === 'reconciled') throw new DomainValidationError('INVALID_COMMAND', 'Abgeglichene Buchungen müssen vor der Empfängerzusammenführung ausdrücklich entsperrt werden.');
    transactionIds.add(transaction.id);
    suppliedById.set(transaction.id, transaction);
  });
  if (transactionIds.size !== currentTransactions.length || currentTransactions.some((transaction) => !transactionIds.has(transaction.id))) {
    throw new DomainValidationError('INVALID_COMMAND', 'Die Empfängerreferenzliste ist unvollständig.');
  }
  const transactions = currentTransactions.map((stored) => {
    const supplied = suppliedById.get(stored.id)!;
    if (supplied.revision !== stored.revision || supplied.spaceId !== stored.spaceId || supplied.payeeId !== stored.payeeId || supplied.clearance !== stored.clearance) {
      throw new DomainValidationError('REVISION_CONFLICT', 'Eine Buchungsreferenz der Empfängerzusammenführung ist nicht mehr aktuell.');
    }
    if (stored.clearance === 'reconciled') throw new DomainValidationError('INVALID_COMMAND', 'Abgeglichene Buchungen müssen vor der Empfängerzusammenführung ausdrücklich entsperrt werden.');
    return stored;
  });

  const aliases = normalizeAliases([
    ...target.aliases,
    ...sources.flatMap((source) => [source.name, ...source.aliases])
  ], target.name, true);
  const revisedTarget = reviseAggregate({ ...target, aliases }, dependencies);
  const archivedSources = sources.map((source) => reviseAggregate({ ...source, archived: true }, dependencies));
  const reassignedTransactions = transactions.map((transaction) =>
    reviseAggregate({ ...transaction, payeeId: target.id }, dependencies)
  );
  const aggregates: readonly P2Aggregate[] = [
    revisedTarget,
    ...archivedSources,
    ...reassignedTransactions
  ];
  validateFinancialReferences(aggregates, current);
  const expectedRevisions = aggregates.map((aggregate) => ({
    id: aggregate.id,
    expectedRevision: aggregate.revision - 1
  }));
  const financialRevision = current.find((aggregate) => aggregate.id === input.spaceId);
  if (financialRevision !== undefined && financialRevision.aggregateType !== 'financialRevision') {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die reservierte lokale Finanzrevision ist nicht verfügbar.');
  }
  expectedRevisions.push({ id: input.spaceId, expectedRevision: financialRevision?.revision ?? 0 });

  return createChangeSet(
    {
      commandType: 'payee.merge',
      spaceId: input.spaceId,
      expectedRevisions,
      mutations: aggregates.map((aggregate) => ({ aggregate }))
    },
    heads,
    dependencies
  );
}

function singleMutation<TCommandType extends 'account.save' | 'account.archive' | 'categoryGroup.save' | 'category.save' | 'category.archive' | 'payee.save', TAggregate extends P2Aggregate>(
  input: FullCommandInput<TCommandType, TAggregate>,
  commandType: TCommandType
): TAggregate {
  if (input.commandType !== commandType || input.mutations.length !== 1) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Der Stammdatenbefehl benötigt genau ein vollständiges Aggregat des passenden Typs.'
    );
  }
  return input.mutations[0]!.aggregate;
}

export function normalizeAccount(account: AccountAggregate): AccountAggregate {
  assertAggregateType(account, 'account', 'Das Konto');
  const name = normalizeRequiredText(account.name, 'Der Kontoname');
  if (!accountTypes.includes(account.type)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Kontoart ist nicht bekannt.');
  }
  assertBoolean(account.onBudget, 'Die Budgetrelevanz');
  assertBoolean(account.archived, 'Der Archivstatus');
  if (account.type === 'credit' && account.onBudget) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Kreditkonten müssen außerhalb des Umschlagbudgets bleiben.'
    );
  }
  return { ...account, name };
}

export function normalizeCategoryGroup(group: CategoryGroupAggregate): CategoryGroupAggregate {
  assertAggregateType(group, 'categoryGroup', 'Die Kategoriegruppe');
  const name = normalizeRequiredText(group.name, 'Der Name der Kategoriegruppe');
  if (!categoryGroupKinds.includes(group.kind)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Kategoriegruppenart ist nicht bekannt.');
  }
  assertSortOrder(group.sortOrder);
  assertBoolean(group.archived, 'Der Archivstatus');
  return { ...group, name };
}

export function normalizeCategory(category: CategoryAggregate): CategoryAggregate {
  assertAggregateType(category, 'category', 'Die Kategorie');
  assertUuid(category.groupId, 'Die Kategoriegruppen-ID');
  const name = normalizeRequiredText(category.name, 'Der Kategoriename');
  assertSortOrder(category.sortOrder);
  assertBoolean(category.archived, 'Der Archivstatus');
  if (category.system !== undefined && category.system !== 'uncategorized') {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Systemkategorietyp ist nicht bekannt.');
  }
  return { ...category, name };
}

export function normalizePayee(payee: PayeeAggregate): PayeeAggregate {
  assertAggregateType(payee, 'payee', 'Der Empfänger');
  const name = normalizeRequiredText(payee.name, 'Der Empfängername');
  assertBoolean(payee.archived, 'Der Archivstatus');
  if (!Array.isArray(payee.aliases)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Die Empfängeraliasse müssen vollständig angegeben werden.');
  }
  return { ...payee, name, aliases: normalizeAliases(payee.aliases, name) };
}

function normalizeAliases(aliases: readonly string[], name: string, deduplicate = false): readonly string[] {
  const normalizedName = normalizeMatchText(name);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const alias of aliases) {
    const display = normalizeRequiredText(alias, 'Ein Empfängeralias');
    const key = normalizeMatchText(display);
    if (key === normalizedName || seen.has(key)) {
      if (deduplicate) continue;
      throw new DomainValidationError(
        'DUPLICATE_REFERENCE',
        'Empfängeraliasse müssen eindeutig sein und dürfen nicht dem Empfängernamen entsprechen.'
      );
    }
    seen.add(key);
    normalized.push(display);
  }
  return Object.freeze(normalized);
}

function requireCategoryGroupRevision(
  expectations: readonly RevisionExpectation[],
  groupId: UUID,
  heads: AggregateHeadReader
): void {
  const expectation = expectations.find((item) => item.id === groupId);
  if (expectation === undefined) {
    throw new DomainValidationError(
      'REVISION_MISSING',
      'Die referenzierte Kategoriegruppe benötigt eine erwartete Revision.'
    );
  }
  const group = heads.get(groupId);
  if (group === undefined || group.aggregateType !== 'categoryGroup') {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Die referenzierte Kategoriegruppe existiert nicht im selben Fachbestand.'
    );
  }
}

function assertPayeeTransactionReference(value: PayeeTransactionReference): void {
  assertAggregateType(value, 'transaction', 'Die Transaktionsreferenz');
  if (!['uncleared', 'cleared', 'reconciled'].includes(value.clearance)) throw new DomainValidationError('INVALID_AGGREGATE', 'Die Transaktionsreferenz benötigt ihren Abgleichstatus.');
  if (value.payeeId !== undefined) {
    assertUuid(value.payeeId, 'Die Empfänger-ID der Transaktionsreferenz');
  }
}

function assertAggregateType<TType extends P2Aggregate['aggregateType']>(
  value: P2Aggregate,
  aggregateType: TType,
  field: string
): asserts value is P2Aggregate {
  if (value.aggregateType !== aggregateType) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} hat einen unpassenden Aggregattyp.`);
  }
}

function assertUuid(value: unknown, field: string): asserts value is UUID {
  if (!uuidSchema.safeParse(value).success) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss eine UUID sein.`);
  }
}

function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss wahr oder falsch sein.`);
  }
}

function assertSortOrder(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Die Sortierreihenfolge muss eine nichtnegative sichere Ganzzahl sein.'
    );
  }
}

function normalizeRequiredText(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} muss Text enthalten.`);
  }
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw new DomainValidationError('INVALID_AGGREGATE', `${field} darf nicht leer sein.`);
  }
  return normalized;
}

function normalizeMatchText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-AT');
}
