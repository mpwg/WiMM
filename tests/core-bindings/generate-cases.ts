// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFile } from 'node:fs/promises';
import { DomainValidationError, parseMoney, assertMoney, sumMoney, subtractMoney, multiplyMoney, multiplyDivideMoney, moneyDecimal, parseDirectedMoney, parseFinanceDate, parseYearMonth, monthOf, reorderRules, createChangeSet, type P2Aggregate, type RuleAggregate } from '../../packages/domain/src/index.js';
import { coreCommandResultSchema, coreCalculationResultSchema, coreStateRequestSchema, type UUID } from '../../packages/contracts/src/index.js';
import { masterCases } from './master-cases.js';
import { stateCases } from './state-cases.js';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const base = { contractVersion: 1, domainSchemaVersion: 1, spaceId: id(1) };
const context = { operationId: id(2), occurredAt: '2026-10-08T12:00:00Z', generatedIds: [] };
const cases: { name: string; method: 'calculate' | 'execute' | 'roundtrip' | 'primitive' | 'validate' | 'project'; request: unknown; expected: unknown }[] = [];
for (const text of ['0', '-0', '+1,2', '-12.34', '000001.05', '90071992547409.91', '-90071992547409,91', '90071992547409.92', '-90071992547409.92', '999999999999999999999999999999999999999999999999999999999', '1,234', ' 1.00', '1.00\n', '1e3', '']) {
  let expected: unknown;
  try { expected = { contractVersion: 1, status: 'money', value: parseMoney(text) }; }
  catch (error) { if (!(error instanceof DomainValidationError)) throw error; expected = { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.message } }; }
  coreCalculationResultSchema.parse(expected);
  cases.push({ name: `Centtext ${JSON.stringify(text)}`, method: 'calculate', request: { ...base, calculationType: 'money.parse', text }, expected });
}
const rule = (n: number): RuleAggregate => ({ id: id(n), spaceId: base.spaceId, revision: 1, aggregateType: 'rule', createdAt: '2026-10-08T10:00:00Z', updatedAt: '2026-10-08T10:00:00Z', order: n,
  conditions: [{ field: 'date', operator: 'equals', value: '2028-02-29' }, { field: 'memo', operator: 'contains', value: 'Österreich – Grüße 🏠' }], actions: [{ field: 'clearance', value: 'cleared' }], enabled: true, stopProcessing: false });
for (const scenario of ['gültig', 'doppelt', 'ausgelassen', 'veraltet', 'revision-grenze', 'revision-überlauf', 'historischer-tombstone'] as const) {
  const rules = [rule(10), { ...rule(11), revision: scenario === 'revision-grenze' ? Number.MAX_SAFE_INTEGER - 1 : scenario === 'revision-überlauf' ? Number.MAX_SAFE_INTEGER : 1 }];
  const ids = scenario === 'doppelt' ? [id(10), id(10)] : scenario === 'ausgelassen' ? [id(10)] : [id(11), id(10)];
  const aggregates: readonly P2Aggregate[] = scenario === 'historischer-tombstone' ? [...rules, { ...rule(12), deletedAt: '2026-10-08T11:00:00Z' }] : rules;
  const expectedRevisions = ids.map((id) => ({ id, expectedRevision: scenario === 'veraltet' ? 0 : rules.find((rule) => rule.id === id)!.revision }));
  let expected: unknown;
  try {
    const deps = { ids: { next: () => context.operationId }, clock: { now: () => context.occurredAt } };
    const change = reorderRules(ids, rules, aggregates, deps);
    // Verbindlicher expliziter Request-CAS, bevor der vorbereitete Befehl zurückgegeben wird.
    const checked = createChangeSet({ commandType: 'rule.reorder', spaceId: base.spaceId, expectedRevisions, mutations: change.aggregates.map((aggregate) => ({ aggregate })) }, { get: (id) => aggregates.find((aggregate) => aggregate.id === id), list: () => aggregates }, deps);
    expected = { contractVersion: 1, status: 'changed', changeSet: checked };
  } catch (error) { if (!(error instanceof DomainValidationError)) throw error; expected = { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.message } }; }
  coreCommandResultSchema.parse(expected);
  cases.push({ name: `Regelreihenfolge ${scenario}`, method: 'execute', request: { ...base, aggregates, command: { commandType: 'rule.reorder', ruleIds: ids }, expectedRevisions, context }, expected });
}
cases.push({ name: 'Unbekannte Bindingversion', method: 'calculate', request: { ...base, contractVersion: 999, calculationType: 'money.parse', text: '1.00' }, expected: { contractVersion: 1, status: 'rejected', error: { code: 'UPDATE_REQUIRED', message: 'Der Enginevertrag wird nicht unterstützt.' } } });
const account = { id: id(50), spaceId: base.spaceId, revision: 1, aggregateType: 'account', createdAt: context.occurredAt, updatedAt: context.occurredAt, name: 'Synthetisches Konto', type: 'cash', onBudget: true, archived: false };
const opening = { id: id(51), spaceId: base.spaceId, revision: 1, aggregateType: 'transaction', createdAt: context.occurredAt, updatedAt: context.occurredAt, accountId: account.id, date: '2028-02-29', amount: Number.MAX_SAFE_INTEGER, kind: 'opening', clearance: 'cleared', splits: [] };
for (const present of [false, true]) {
  const request = coreStateRequestSchema.parse({ ...base, aggregates: [account, { ...opening, ...(present ? { note: 'Grüße 🏠', importReference: 'Synthetischer Herkunftshinweis' } : {}) }] });
  cases.push({ name: `Feldtransport ${present ? 'optionale Felder vorhanden' : 'optionale Felder abwesend'}`, method: 'roundtrip', request, expected: request });
}
// K04: sämtliche Fälle der bisherigen primitives.test.ts und zusätzliche Vorzeichen-/Jahrhundertgrenzen.
const max = Number.MAX_SAFE_INTEGER;
function primitive(name: string, args: unknown[], action: () => unknown) {
  let expected: unknown;
  try { expected = { contractVersion: 1, status: 'primitive', value: action() }; }
  catch (error) { if (!(error instanceof DomainValidationError)) throw error; expected = { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.message } }; }
  cases.push({ name: `${name} ${JSON.stringify(args)}`, method: 'primitive', request: { ...base, primitive: name, args }, expected });
}
for (const value of [0, max, -max, max + 1, -max - 1, 1.5]) primitive('money.assert', [value], () => assertMoney(value));
for (const values of [[], [1234, -34, 800], [max, 1, -1], [-max, -1, 1], [max, -max], [max + 1], [1.5]]) primitive('money.sum', [values], () => sumMoney(values));
for (const [left, right] of [[100, 30], [max, -1], [-max, 1], [max, max], [max + 1, 1]]) primitive('money.subtract', [left, right], () => subtractMoney(left!, right!));
for (const [amount, factor] of [[100, 2], [100, -2], [max, 2], [-max, 2], [100, 1.5], [max + 1, 1], [0, max], [100, max + 1]]) primitive('money.multiply', [amount, factor], () => multiplyMoney(amount!, factor!));
for (const [amount, numerator, denominator] of [[1001, 1, 2], [-1001, 1, 2], [1001, -1, 2], [max, max, max], [-max, max, max], [max, 2, 1], [100, 1, 0], [100, 1, -1], [100, 1.5, 2], [100, 1, 1.5], [100, max + 1, 1]]) primitive('money.divide', [amount, numerator, denominator], () => multiplyDivideMoney(amount!, numerator!, denominator!));
for (const value of [0, 1, -1, 1234, -1234, max, -max, max + 1]) primitive('money.decimal', [value], () => moneyDecimal(value));
for (const text of ['0', '-0', '+12,3', '-12.34', '90071992547409.91', '-90071992547409.91', '90071992547409.92', '1e2']) for (const direction of ['expense', 'income'] as const) primitive('money.directed', [text, direction], () => parseDirectedMoney(text, direction));
for (const text of ['2028-02-29', '2027-02-28', '0000-02-29', '1900-02-29', '2000-02-29', '2100-02-29', '9999-12-31', '2027-02-29', '2028-13-01', '2028-04-31', '2028-2-01', '2028-02-01T00:00:00Z', '2028-00-01', '2028-01-00', '２０２８-02-29']) primitive('calendar.date', [text], () => parseFinanceDate(text));
for (const text of ['2028-02', '0000-01', '9999-12', '2028-2', '2028-00', '2028-13', '2028-02\n']) primitive('calendar.month', [text], () => parseYearMonth(text));
for (const text of ['2028-02-29', '0000-02-29', '9999-12-31']) primitive('calendar.monthOf', [text], () => monthOf(parseFinanceDate(text)));
// Die übrigen gültigen/ungültigen Geldtexte aus primitives.test.ts laufen durch den echten Produktvertrag.
for (const text of ['12', '+12,3', '00012,34', ' 12', '12 ', '1.2.3', '1e2', '12,', '--12']) {
  let expected: unknown;
  try { expected = { contractVersion: 1, status: 'money', value: parseMoney(text) }; }
  catch (error) { if (!(error instanceof DomainValidationError)) throw error; expected = { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.message } }; }
  cases.push({ name: `K04 Centtext ${JSON.stringify(text)}`, method: 'calculate', request: { ...base, calculationType: 'money.parse', text }, expected });
}
cases.push(...stateCases(),...masterCases());
await writeFile('test-results/core-bindings/cases.json' , `${JSON.stringify(cases, null, 2)}\n`);
