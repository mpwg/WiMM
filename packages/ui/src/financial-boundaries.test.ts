// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { MemoryStorageAdapter, toStoredAggregate } from '@wimm/storage';
import { type DomainChangeSet, moneyDecimal } from '@wimm/domain';
import { FinanceModel } from './workspace.js';
import { FinanceHistory } from './history.js';

const space = '00000000-0000-4000-8000-000000000001';
async function fixture() {
  const storage = new MemoryStorageAdapter('00000000-0000-4000-8000-000000000002');
  const history = new FinanceHistory();
  const read = () => storage.query({ spaceId: space });
  async function commit(change: DomainChangeSet) {
    const before = await read();
    await storage.applyAtomicBatch({ expectedRevisions: change.expectedRevisions.map(e => ({ handle: e.id, expectedRevision: e.expectedRevision })), aggregates: change.aggregates.map(toStoredAggregate), outbox: [], projections: [] });
    history.record(change, before);
  }
  let nextId = 20;
  const model = async () => {
    const result = new FinanceModel(space, await read(), commit);
    result.domainDependencies.ids.next = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
    return result;
  };
  await (await model()).addAccount('A', 'checking', true);
  await (await model()).addAccount('B', 'checking', true);
  await (await model()).addGroup('Einnahmen', 'income');
  await (await model()).addCategory('Einkommen', (await model()).groups[0]!.id);
  async function book(amount: number, accountIndex = 0, previous?: (Awaited<ReturnType<typeof model>>)['transactions'][number]) {
    const m = await model(); await m.storeTransaction({ accountId: m.accounts[accountIndex]!.id, amount: moneyDecimal(amount), date: '2026-10-07', note: '', opening: false, splits: [{ categoryId: m.categories[0]!.id, amount: moneyDecimal(amount) }] }, previous);
  }
  return { storage, history, read, model, book, commit };
}
describe('Finanzgrenzen vor dem Commit', () => {
  it.each([1, -1])('weist Überlauf mit Vorzeichen %i ohne Teilwrite ab', async sign => {
    const f = await fixture(); await f.book(sign * Number.MAX_SAFE_INTEGER);
    const before = await f.read(); await expect(f.book(sign)).rejects.toThrow('Centbereich'); expect(await f.read()).toEqual(before);
    await expect(f.book(sign, 1)).rejects.toThrow('Centbereich'); expect(await f.read()).toEqual(before);
  });
  it('prüft Änderung, Löschung und Transferziel', async () => {
    const f = await fixture(); await f.book(Number.MAX_SAFE_INTEGER); await f.book(-1); await f.book(1);
    let m = await f.model(); const offset = m.transactions.find(t => t.amount === -1)!; const before = await f.read();
    await expect(m.removeTransaction(offset)).rejects.toThrow('Centbereich'); expect(await f.read()).toEqual(before);
    await expect(f.book(1, 0, offset)).rejects.toThrow('Centbereich'); expect(await f.read()).toEqual(before);
    // Der Zielsaldo ist maximal; die Quelle besitzt einen negativen Gegenstand.
    await f.book(-Number.MAX_SAFE_INTEGER); await f.book(Number.MAX_SAFE_INTEGER, 1);
    m = await f.model(); const transferBefore = await f.read();
    await expect(m.addTransfer(m.accounts[0]!.id, m.accounts[1]!.id, '0.01', '2026-10-07')).rejects.toThrow('Centbereich'); expect(await f.read()).toEqual(transferBefore);
  });
  it('weist einen durch Fremdbuchungen unsicher gewordenen Gegenbefehl ab', async () => {
    const f = await fixture(); await f.book(Number.MAX_SAFE_INTEGER); await f.book(-1);
    const priorHistory = f.history;
    // Fremdbuchung läuft ohne Eintrag in dieselbe Historie.
    const m = new FinanceModel(space, await f.read(), async change => { await f.storage.applyAtomicBatch({ expectedRevisions: change.expectedRevisions.map(e => ({ handle: e.id, expectedRevision: e.expectedRevision })), aggregates: change.aggregates.map(toStoredAggregate), outbox: [], projections: [] }); });
    await m.storeTransaction({ accountId: m.accounts[0]!.id, amount: '0.01', date: '2026-10-07', note: '', opening: false, splits: [{ categoryId: m.categories[0]!.id, amount: '0.01' }] });
    const before = await f.read(); await expect(priorHistory.move('undo', before, m.domainDependencies, f.commit)).rejects.toThrow(/aktuell|Centbereich/); expect(await f.read()).toEqual(before);
  });
  it('lässt zwei parallele Grenzwrites höchstens einmal committen', async () => {
    const f = await fixture(); await f.book(Number.MAX_SAFE_INTEGER - 1);
    const m = await f.model(); const input = { accountId: m.accounts[0]!.id, amount: '0.01', date: '2026-10-07', note: '', opening: false, splits: [{ categoryId: m.categories[0]!.id, amount: '0.01' }] };
    const outcomes = await Promise.allSettled([m.storeTransaction(input), m.storeTransaction(input)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    expect((await f.model()).transactions).toHaveLength(2);
  });
});

it('serialisiert parallele Anfangsbestände auch bei neu angelegten Konten', async () => {
  const f = await fixture(); const m = await f.model(); const opening = { amount: moneyDecimal(Number.MAX_SAFE_INTEGER), date: '2026-10-07' };
  const results = await Promise.allSettled([m.addAccount('Neu A', 'checking', true, opening), m.addAccount('Neu B', 'checking', true, opening)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await f.model()).transactions).toHaveLength(1);
});
it('schützt zwei gleichzeitige erste Konten über eine gemeinsame Finanzrevision', async () => {
  const storage = new MemoryStorageAdapter('00000000-0000-4000-8000-000000000002');
  const m = new FinanceModel(space, [], async change => storage.applyAtomicBatch({ expectedRevisions: change.expectedRevisions.map(e => ({ handle: e.id, expectedRevision: e.expectedRevision })), aggregates: change.aggregates.map(toStoredAggregate), outbox: [], projections: [] }));
  const opening = { amount: moneyDecimal(Number.MAX_SAFE_INTEGER), date: '2026-10-07' };
  const results = await Promise.allSettled([m.addAccount('Erstes A', 'checking', true, opening), m.addAccount('Erstes B', 'checking', true, opening)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await storage.query({ spaceId: space })).filter(a => a.aggregateType === 'account')).toHaveLength(1);
});
