// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { coreCommandRequestSchema, coreCommandResultSchema, coreCalculationRequestSchema, coreCalculationResultSchema, coreInverseRequestSchema, coreProjectionResultSchema, coreValidationRequestSchema, storageMigrationPlanSchema, financeCommandTypes } from './finance-engine.js';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const account = { id: id(10), spaceId: id(1), revision: 1, createdAt: '2026-10-08T12:00:00Z', updatedAt: '2026-10-08T12:00:00Z', aggregateType: 'account', name: 'Österreichisches Testkonto', type: 'cash', onBudget: true, archived: false };
const base = { contractVersion: 1, domainSchemaVersion: 1, spaceId: id(1) };
const request = { ...base, aggregates: [], command: { commandType: 'account.save', aggregates: [account] }, expectedRevisions: [{ id: account.id, expectedRevision: 0 }], context: { operationId: id(2), occurredAt: account.updatedAt, generatedIds: [id(3)] } };
describe('Sprachneutrale Finanzengine-Verträge', () => {
  it('überträgt UUIDs, Zeitpunkte, Unicode und fehlende optionale Felder ohne Verlust', () => {
    const parsed = coreCommandRequestSchema.parse(request);
    expect(coreCommandRequestSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(parsed.command).toEqual(request.command);
  });
  it('begrenzt die unterstützten Befehle auf vorhandene Funktionen und trennt UI/SQL/Handles', () => {
    expect(financeCommandTypes).toHaveLength(22);
    for (const command of [{ commandType: 'budget.assign', amount: 100 }, { commandType: 'executeSql', sql: 'SELECT 1' }, { ...request.command, uiEvent: 'click' }, { commandType: 'account.save', aggregates: [{ ...account, handle: account.id }] }]) expect(coreCommandRequestSchema.safeParse({ ...request, command }).success).toBe(false);
  });
  it.each([0, 2, 999])('weist unbekannte Binding-/Fachversion %s ab', (version) => {
    expect(coreCommandRequestSchema.safeParse({ ...request, contractVersion: version }).success).toBe(false);
    expect(coreCommandRequestSchema.safeParse({ ...request, domainSchemaVersion: version }).success).toBe(false);
  });
  it('erhält sichere Centgrenzen und weist Rundungs-/Präzisionsverlust ab', () => {
    const tx = { id: account.id, spaceId: account.spaceId, revision: account.revision, createdAt: account.createdAt, updatedAt: account.updatedAt, aggregateType: 'transaction', accountId: account.id, date: '2026-10-08', amount: Number.MAX_SAFE_INTEGER, kind: 'opening', clearance: 'cleared', splits: [] };
    const withAmount = (amount: number) => ({ ...request, command: { commandType: 'transaction.save', aggregates: [{ ...tx, amount }] } });
    expect(coreCommandRequestSchema.safeParse(withAmount(Number.MAX_SAFE_INTEGER)).success).toBe(true);
    for (const amount of [Number.MAX_SAFE_INTEGER + 1, 0.01, NaN, Infinity]) expect(coreCommandRequestSchema.safeParse(withAmount(amount)).success).toBe(false);
    expect(coreCalculationResultSchema.parse({ contractVersion: 1, status: 'money', value: -Number.MAX_SAFE_INTEGER })).toEqual({ contractVersion: 1, status: 'money', value: -Number.MAX_SAFE_INTEGER });
  });
  it('stellt unveränderte/idempotente Ergebnisse und strukturierte Ablehnung ausdrücklich dar', () => {
    expect(coreCommandResultSchema.parse({ contractVersion: 1, status: 'unchanged' }).status).toBe('unchanged');
    expect(coreCommandResultSchema.parse({ contractVersion: 1, status: 'rejected', error: { code: 'MONEY_OVERFLOW', message: 'Die Summe ist nicht sicher.' } }).status).toBe('rejected');
    expect(coreCommandResultSchema.safeParse({ contractVersion: 1, status: 'rejected', error: { code: 'FEHLER', message: 'Fehler' } }).success).toBe(false);
    expect(coreCommandResultSchema.safeParse({ contractVersion: 1, status: 'rejected', error: { code: 'INVALID_COMMAND', message: 'Fehler', originalFinancePayload: account } }).success).toBe(false);
  });
  it('liefert vollständige Änderungsmengen ohne Speicher- oder Servererfolg zu behaupten', () => {
    const changeSet = { spaceId: request.spaceId, operationId: request.context.operationId, occurredAt: account.updatedAt, commandType: 'account.save', expectedRevisions: request.expectedRevisions, aggregates: [account] };
    const result = { contractVersion: 1, status: 'changed', changeSet };
    expect(coreCommandResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
    expect(coreCommandResultSchema.safeParse({ ...result, storageCommitted: true }).success).toBe(false);
  });
  it('unterscheidet historische Bestandsprüfung und Mutation sowie gezielte Gegenbefehle', () => {
    expect(coreValidationRequestSchema.parse({ ...base, mode: 'historical', aggregates: [account] }).mode).toBe('historical');
    expect(coreValidationRequestSchema.safeParse({ ...base, mode: 'mutation', after: [] }).success).toBe(false);
    expect(coreInverseRequestSchema.parse({ ...base, aggregates: [], targets: [{ id: id(11) }], expectedRevisions: [{ id: id(11), expectedRevision: 1 }], context: request.context }).targets[0]?.previous).toBeUndefined();
  });
  it('beschreibt Regeln, Dauerzahlungen und Importklassifikation ohne Browser-Worker', () => {
    const candidate = { sourceRow: 1, date: '2026-10-08', amount: -100, memo: 'Synthetischer Text' };
    expect(coreCalculationRequestSchema.parse({ ...base, calculationType: 'rule.apply', aggregates: [], candidate }).calculationType).toBe('rule.apply');
    expect(coreCalculationRequestSchema.parse({ ...base, calculationType: 'schedule.dueDates', aggregates: [], scheduleId: id(20), through: '2028-02-29' }).calculationType).toBe('schedule.dueDates');
    expect(coreCalculationRequestSchema.parse({ ...base, calculationType: 'import.classify', aggregates: [], accountId: account.id, candidates: [candidate] }).calculationType).toBe('import.classify');
    expect(coreCalculationResultSchema.parse({ contractVersion: 1, status: 'classified', rows: [{ sourceRow: 1, classification: 'conflict' }] }).status).toBe('classified');
  });
  it('prüft Saldo-/Verbrauchsausgaben ebenfalls auf sichere Ganzzahlwerte', () => {
    const projections = { accountBalances: [{ accountId: account.id, balance: 100 }], consumption: { income: 0, expense: 0, net: 0, categories: [] } };
    expect(coreProjectionResultSchema.parse({ contractVersion: 1, status: 'projected', projections }).status).toBe('projected');
    expect(coreProjectionResultSchema.safeParse({ contractVersion: 1, status: 'projected', projections: { ...projections, accountBalances: [{ accountId: account.id, balance: 0.1 }] } }).success).toBe(false);
  });
});
it('fordert lückenlose nummerierte Vorwärtsmigration und getrennte Versionsdimensionen', () => {
  const from = { storageSchemaVersion: 1, domainSchemaVersion: 1 };
  const to = { storageSchemaVersion: 2, domainSchemaVersion: 1 };
  const step = { number: 1, from, to, destructive: true };
  expect(storageMigrationPlanSchema.parse({ expectedMigrationNumber: 0, from, steps: [step] }).steps[0]?.to).toEqual(to);
  for (const invalid of [{ ...step, number: 2 }, { ...step, to: from }, { ...step, from: to, to: from }, { ...step, from: { storageSchemaVersion: 1, domainSchemaVersion: 2 } }]) expect(storageMigrationPlanSchema.safeParse({ expectedMigrationNumber: 0, from, steps: [invalid] }).success).toBe(false);
});
