// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { FinanceModel, AutomationModel } from './index.js';
import type { DomainChangeSet, ImportBatchAggregate } from '@wimm/domain';
import type { CancellationPort } from '@wimm/contracts';
const id = '40000000-0000-4000-8000-000000000001';
const dependencies = { ids: { next: () => '40000000-0000-4000-8000-000000000002' }, clock: { now: () => '2026-10-08T12:00:00Z' } };
afterEach(() => vi.unstubAllGlobals());
it('führt Finanzaktionen mit injizierter Uhr/IDs ohne React oder Browserglobals aus', async () => {
  for (const name of ['window', 'document', 'navigator', 'localStorage', 'Worker', 'crypto']) vi.stubGlobal(name, undefined);
  let change: DomainChangeSet | undefined;
  const finance = new FinanceModel(id, [], async (value) => { change = value; }, dependencies);
  await finance.addAccount('Synthetisches Konto', 'cash', true);
  expect(change).toMatchObject({ spaceId: id, occurredAt: dependencies.clock.now(), aggregates: [{ id: dependencies.ids.next(), name: 'Synthetisches Konto', type: 'cash' }] });
});
it('wendet eine späte Importvorbereitung nach Abbruch nicht an', async () => {
  for (const name of ['window', 'document', 'navigator', 'localStorage', 'Worker']) vi.stubGlobal(name, undefined);
  let resolve: ((value: DomainChangeSet) => void) | undefined;
  const commit = vi.fn<(value: DomainChangeSet) => Promise<void>>(async () => {});
  const finance = new FinanceModel(id, [], commit, dependencies);
  const automation = new AutomationModel(finance, { execute: () => new Promise((done) => { resolve = done; }) });
  let cancelled = false;
  const cancellation: CancellationPort = { isCancelled: () => cancelled, onCancel: () => () => {} };
  const batch = { id, spaceId: id } as ImportBatchAggregate;
  const pending = automation.next(batch, cancellation);
  cancelled = true;
  resolve!({ commandType: 'import.commit', operationId: id, spaceId: id, occurredAt: dependencies.clock.now(), expectedRevisions: [], aggregates: [] });
  await expect(pending).rejects.toThrow('abgebrochen');
  expect(commit).not.toHaveBeenCalled();
});
it('bildet Fachkandidaten ohne Parserfelder und erhält Originalvorschau', () => {
  const finance = new FinanceModel(id, [], async () => {}, dependencies);
  const automation = new AutomationModel(finance,{execute:async()=>null});
  const record = { sourceRow: 1, date: '2026-10-07', amount: 100, currency: 'EUR' as const, memo: 'Synthetische Originalnotiz' };
  const row = {source:{sourceRow:1,line:1,cells:[],issues:[]},record,issues:[]} as import('@wimm/importers').PreviewRow;
  const before = structuredClone(row);
  const result = automation.ruleResult(row,'csv');
  expect(result?.candidate).toMatchObject({sourceRow:1,date:'2026-10-07',amount:100,parserSource:'csv',memo:'Synthetische Originalnotiz'});
  expect(result?.candidate).not.toHaveProperty('currency');
  expect(result?.candidate.sourceFingerprint).toBeTypeOf('string');
  expect(row).toEqual(before);
});
