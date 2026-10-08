// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import type { UUID } from '@wimm/contracts';
import { validateFinancialProjectionCache, validateFinancialState } from './aggregate-validation.js';
import type { P2Aggregate } from './commands.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const spaceId = id(1), now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
const account = { ...meta(2), aggregateType: 'account' as const, name: 'Giro', type: 'checking' as const, onBudget: true, archived: false };
const expenseGroup = { ...meta(3), aggregateType: 'categoryGroup' as const, name: 'Ausgaben', kind: 'expense' as const, sortOrder: 0, archived: false };
const incomeGroup = { ...expenseGroup, ...meta(4), name: 'Einnahmen', kind: 'income' as const };
const category = { ...meta(5), aggregateType: 'category' as const, name: 'Lebensmittel', groupId: expenseGroup.id, sortOrder: 0, archived: false };
const incomeCategory = { ...category, ...meta(6), name: 'Einkommen', groupId: incomeGroup.id };
const opening = { ...meta(7), aggregateType: 'transaction' as const, accountId: account.id, date: '2026-10-08', amount: 100_000, kind: 'opening' as const, clearance: 'cleared' as const, splits: [] };
const expense = { ...opening, ...meta(8), kind: 'normal' as const, amount: -10_000, splits: [{ id: id(9), categoryId: category.id, amount: -10_000 }] };
const income = { ...expense, ...meta(10), amount: 20_000, splits: [{ id: id(11), categoryId: incomeCategory.id, amount: 20_000 }] };
const base: readonly P2Aggregate[] = [account, expenseGroup, incomeGroup, category, incomeCategory, opening, expense, income];

it('validiert F01 und weist fehlende Referenzen, falsche F02-Splits und falsche Caches ab', () => {
  expect(() => validateFinancialState(base, spaceId)).not.toThrow();
  expect(() => validateFinancialProjectionCache(base, [{ kind: 'accountBalance', key: account.id, payload: { balance: 110_000 } }])).not.toThrow();
  expect(() => validateFinancialState(base.filter((entry) => entry.id !== category.id), spaceId)).toThrow('Fachvertrag');
  const badSplit = { ...expense, splits: [{ ...expense.splits[0]!, amount: -9_999 }] };
  expect(() => validateFinancialState(base.map((entry) => entry.id === expense.id ? badSplit : entry), spaceId)).toThrow('Splitsumme');
  expect(() => validateFinancialProjectionCache(base, [{ kind: 'accountBalance', key: account.id, payload: { balance: 110_001 } }])).toThrow('Fachvertrag');
});

it('validiert vollständige F03-Transferpaare und erhält historische archivierte Ziele', () => {
  const second = { ...account, ...meta(20), name: 'Bar', archived: true };
  const transfer = { ...meta(21), aggregateType: 'transfer' as const, date: opening.date, sourceAccountId: account.id, targetAccountId: second.id, sourceTransactionId: id(22), targetTransactionId: id(23), amount: 20_000 };
  const source = { ...opening, ...meta(22), kind: 'transfer' as const, transferId: transfer.id, amount: -20_000 };
  const target = { ...source, ...meta(23), accountId: second.id, amount: 20_000 };
  const state = [...base, second, transfer, source, target];
  expect(() => validateFinancialState(state, spaceId)).not.toThrow();
  expect(() => validateFinancialState(state.filter((entry) => entry.id !== target.id), spaceId)).toThrow('Fachvertrag');
});

it('erhält bestätigte importierte Dauerzahlungen mit abweichendem tatsächlichem Zahlungsdatum', () => {
  const schedule = { ...meta(30), aggregateType: 'schedule' as const, startDate: '2026-10-08', frequency: 'monthly' as const, interval: 1, enabled: true,
    template: { accountId: account.id, amount: expense.amount, kind: 'normal' as const, clearance: 'cleared' as const, splits: expense.splits } };
  const occurrence = { ...meta(31), aggregateType: 'scheduleOccurrence' as const, scheduleId: schedule.id, dueDate: '2026-10-08', state: 'confirmed' as const, transactionId: id(32) };
  const payment = { ...expense, ...meta(32), date: '2026-10-09', scheduleOccurrenceId: occurrence.id };
  expect(() => validateFinancialState([...base, schedule, occurrence, payment], spaceId)).not.toThrow();
});

it('erhält ursprüngliche Importfingerprints nach späterem Kontowechsel der Buchung', () => {
  const second = { ...account, ...meta(20), name: 'Bar' };
  const payment = { ...expense, ...meta(40), accountId: second.id };
  const batch = { ...meta(41), aggregateType: 'importBatch' as const, fileHash: 'a'.repeat(64), accountId: account.id,
    rows: [{ sourceRow: 1, candidate: { sourceRow: 1, date: expense.date, amount: expense.amount, categoryId: category.id }, decision: 'import' as const, issues: [] }], committedRows: [1], state: 'completed' as const };
  const fingerprint = { ...meta(42), aggregateType: 'importFingerprint' as const, accountId: account.id, parserSource: 'csv', fingerprint: 'synthetischer-fingerprint', transactionId: payment.id, importId: batch.id, sourceRow: 1 };
  expect(() => validateFinancialState([...base, second, payment, batch, fingerprint], spaceId)).not.toThrow();
});
