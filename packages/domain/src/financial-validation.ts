// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import { reviseAggregate, type AggregateHeadReader, type DomainDependencies, type P2Aggregate, type RevisionExpectation, type FinancialRevisionAggregate } from './commands.js';
import { DomainValidationError } from './errors.js';
import { sumMoney } from './money.js';
import { normalizeTransaction, type TransactionAggregate } from './transactions.js';
import { projectAccountBalances, projectConsumption } from './projections.js';
import type { CategoryAggregate, CategoryGroupAggregate } from './master-data.js';
import { validateFinancialReferences } from './financial-references.js';

/** Prüft den vollständigen Folgebestand und schützt sämtliche gelesenen Konten per CAS. */
export function validateFinancialMutation(spaceId: UUID, changes: readonly P2Aggregate[], expected: readonly RevisionExpectation[], heads: AggregateHeadReader, deps: DomainDependencies) {
  if (!changes.some(a => a.aggregateType === 'transaction')) return { aggregates: changes, expectedRevisions: expected };
  if (heads.list === undefined) throw new DomainValidationError('INVALID_COMMAND', 'Finanzänderungen benötigen den vollständigen aktuellen Fachbestand.');
  const current = heads.list(spaceId);
  if (current.some(a => a.spaceId !== spaceId) || new Set(current.map(a => a.id)).size !== current.length) throw new DomainValidationError('INVALID_AGGREGATE', 'Der Finanzbestand ist nicht eindeutig im aktuellen Bereich.');
  validateFinancialReferences(changes, current);
  const next = new Map(current.map(a => [a.id, a]));
  changes.forEach(a => next.set(a.id, a));
  const txs = [...next.values()].filter((a): a is TransactionAggregate => a.aggregateType === 'transaction' && a.deletedAt === undefined).map(normalizeTransaction).sort((a, b) => a.id.localeCompare(b.id));
  const balances = projectAccountBalances(txs);
  sumMoney(balances.map(a => a.balance), 'Der Gesamtkontostand');
  const categories = [...next.values()].filter((a): a is CategoryAggregate => a.aggregateType === 'category');
  const groups = [...next.values()].filter((a): a is CategoryGroupAggregate => a.aggregateType === 'categoryGroup');
  projectConsumption(txs, categories, groups);
  const months = new Map<string, TransactionAggregate[]>();
  for (const tx of txs) { const key = tx.date.slice(0, 7); const entries = months.get(key) ?? []; entries.push(tx); months.set(key, entries); }
  for (const entries of months.values()) { sumMoney(entries.map(tx => tx.amount), 'Die Monatssumme'); projectConsumption(entries, categories, groups); }
  const affected = new Set(changes.filter((a): a is TransactionAggregate => a.aggregateType === 'transaction').flatMap(tx => {
    const old = current.find(a => a.id === tx.id) as TransactionAggregate | undefined;
    return old === undefined ? [tx.accountId] : [tx.accountId, old.accountId];
  }));
  const mutations = new Map(changes.map(a => [a.id, a]));
  // Auch neue Konten ändern einen gemeinsamen Bestand, ohne einen bisherigen
  // Kontokopf zu mutieren. Die reservierte lokale Bereichsrevision schließt diese Lücke.
  const previousGuard = current.find(a => a.id === spaceId);
  if ((previousGuard !== undefined && previousGuard.aggregateType !== 'financialRevision') || (mutations.has(spaceId) && mutations.get(spaceId)!.aggregateType !== 'financialRevision')) throw new DomainValidationError('INVALID_AGGREGATE', 'Die reservierte lokale Finanzrevision ist nicht verfügbar.');
  const guard: FinancialRevisionAggregate = previousGuard === undefined
    ? { id: spaceId, spaceId, aggregateType: 'financialRevision', revision: 1, createdAt: deps.clock.now(), updatedAt: deps.clock.now() }
    : reviseAggregate(previousGuard as FinancialRevisionAggregate, deps);
  if (!mutations.has(spaceId)) mutations.set(spaceId, guard);
  const revisions = new Map(expected.map(e => [e.id, e]));
  revisions.set(spaceId, { id: spaceId, expectedRevision: previousGuard?.revision ?? 0 });
  for (const reference of current.filter(a => ['category', 'categoryGroup'].includes(a.aggregateType))) {
    if (!revisions.has(reference.id)) revisions.set(reference.id, { id: reference.id, expectedRevision: reference.revision });
  }
  for (const account of current.filter(a => a.aggregateType === 'account' && a.deletedAt === undefined)) {
    if (!revisions.has(account.id)) revisions.set(account.id, { id: account.id, expectedRevision: account.revision });
    if (affected.has(account.id) && !mutations.has(account.id)) mutations.set(account.id, reviseAggregate(account, deps));
  }
  return { aggregates: [...mutations.values()], expectedRevisions: [...revisions.values()] };
}
