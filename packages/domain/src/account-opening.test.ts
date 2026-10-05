// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { DomainValidationError, createAccountWithOpening, parseDirectedMoney, projectConsumption, projectAccountBalances, type AccountAggregate, type DomainDependencies } from './index.js';
const account: AccountAggregate = { id: '00000000-0000-4000-8000-000000000002', spaceId: '00000000-0000-4000-8000-000000000001', revision: 1, createdAt: '2026-10-05T12:00:00Z', updatedAt: '2026-10-05T12:00:00Z', aggregateType: 'account', name: 'Girokonto', type: 'checking', onBudget: true, archived: false };
function dependencies(): DomainDependencies { let counter = 10; return { ids: { next: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}` }, clock: { now: () => account.createdAt } }; }
const heads = { get: () => undefined };
it('erstellt Konto und Anfangsbuchung zusammen, ohne Konsumeinnahme', () => {
  const change = createAccountWithOpening(account, { amount: '1234,56', date: '2026-10-05' }, heads, dependencies());
  expect(change.aggregates).toHaveLength(2);
  expect(change.expectedRevisions).toHaveLength(2);
  const transactions = change.aggregates.filter(entry => entry.aggregateType === 'transaction');
  expect(projectAccountBalances(transactions)[0]?.balance).toBe(123456);
  expect(projectConsumption(transactions, [], [])).toMatchObject({ income: 0, expense: 0 });
});
it('lehnt falsches Datum, unsicheren Betrag, Kreditbudget und bestehendes Konto ohne Teiländerung ab', () => {
  for (const opening of [{ amount: '1', date: '2026-02-30' }, { amount: '900719925474099,99', date: '2026-10-05' }]) expect(() => createAccountWithOpening(account, opening, heads, dependencies())).toThrow(DomainValidationError);
  expect(() => createAccountWithOpening({ ...account, type: 'credit' }, undefined, heads, dependencies())).toThrow(DomainValidationError);
  expect(() => createAccountWithOpening(account, undefined, { get: () => account }, dependencies())).toThrow(DomainValidationError);
  expect(createAccountWithOpening(account, undefined, heads, dependencies()).aggregates).toHaveLength(1);
});
it('interpretiert Ausgaben, Einnahmen und Erstattungen anhand der expliziten Richtung exakt', () => {
  expect(parseDirectedMoney('42,50', 'expense')).toBe(-4250);
  expect(parseDirectedMoney('-42,50', 'income')).toBe(4250);
  expect(parseDirectedMoney('90071992547409,91', 'expense')).toBe(-Number.MAX_SAFE_INTEGER);
  expect(() => parseDirectedMoney('90071992547409,92', 'expense')).toThrow(DomainValidationError);
  expect(() => parseDirectedMoney('1,234', 'income')).toThrow(DomainValidationError);
});
