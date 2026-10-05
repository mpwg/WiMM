// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { UUID } from '@wimm/contracts';
import { MemoryStorageAdapter, toStoredAggregate, type StoredAggregate } from '@wimm/storage';
import { unlockFinanceSelection, projectAccountBalances, projectConsumption, type DomainChangeSet } from '@wimm/domain';
import { FinanceModel } from './workspace.js';
import { FinanceHistory } from './history.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
const space = id(1);
async function fixture() {
  let fail = false;
  const adapter = new MemoryStorageAdapter(id(2), { beforeCommit() { if (fail) throw new Error('disk full'); } });
  const history = new FinanceHistory();
  const read = () => adapter.query({ spaceId: space });
  async function apply(change: DomainChangeSet, record = true) {
    const before = await read();
    await adapter.applyAtomicBatch({ expectedRevisions: change.expectedRevisions.map((entry) => ({ handle: entry.id, expectedRevision: entry.expectedRevision })), aggregates: change.aggregates.map(toStoredAggregate), outbox: [], projections: [] });
    if (record) history.record(change, before);
  }
  const model = async () => new FinanceModel(space, await read(), apply);
  await (await model()).addAccount('Giro', 'checking', true);
  await (await model()).addAccount('Bar', 'cash', true);
  await (await model()).addAccount('Extern', 'savings', false);
  await (await model()).addGroup('Alltag', 'expense');
  await (await model()).addCategory('Lebensmittel', (await model()).groups[0]!.id);
  const input = (amount: string, note = 'Test') => ({ accountId: (undefined as unknown as UUID), amount, date: '2026-10-05', note, opening: false, splits: [] as { categoryId: UUID; amount: string }[] });
  const booking = async (amount: string, opening = false) => { const m = await model(); await m.storeTransaction({ ...input(amount), opening, accountId: m.accounts[0]!.id, splits: opening ? [] : [{ categoryId: m.categories[0]!.id, amount }] }); };
  const move = async (direction: 'undo' | 'redo') => history.move(direction, await read(), (await model()).domainDependencies, (change) => apply(change, false));
  const stale = async (aggregate: StoredAggregate) => adapter.applyAtomicBatch({ expectedRevisions: [{ handle: aggregate.id, expectedRevision: aggregate.revision }], aggregates: [{ ...aggregate, revision: aggregate.revision + 1, note: 'Fremdänderung' } as StoredAggregate], outbox: [], projections: [] });
  return { adapter, history, read, model, booking, move, stale, fail: (value: boolean) => { fail = value; } };
}
describe('lokale Finanzgegenbefehle', () => {
  it('stellt Erfassung, Änderung und Löschung mit monotonen Revisionen wieder her und verwirft den Redozweig', async () => {
    const f = await fixture(); await f.booking('-10');
    let m = await f.model(); const transaction = m.transactions[0]!;
    await m.storeTransaction({ accountId: transaction.accountId, amount: '-20', date: transaction.date, note: 'Geändert', opening: false, splits: [{ categoryId: m.categories[0]!.id, amount: '-20' }] }, transaction);
    await f.move('undo'); expect((await f.model()).transactions[0]!.amount).toBe(-1000);
    await f.move('undo'); expect((await f.model()).transactions).toHaveLength(0);
    await f.move('redo'); expect((await f.model()).transactions[0]!.amount).toBe(-1000);
    await f.move('redo'); expect((await f.model()).transactions[0]!.amount).toBe(-2000);
    m = await f.model(); await m.removeTransaction(m.transactions[0]!); await f.move('undo'); expect((await f.model()).transactions[0]!.note).toBe('Geändert');
    await f.move('redo'); expect((await f.model()).transactions).toHaveLength(0);
    await f.move('undo'); await f.booking('-1'); expect(f.history.canRedo).toBe(false);
  });
  it('führt F03, Transferänderung/-löschung, Abgleich und Entsperrung atomar vorwärts und rückwärts aus', async () => {
    const f = await fixture(); await f.booking('1000', true);
    let m = await f.model(); const [source, target] = m.accounts;
    await m.addTransfer(source!.id, target!.id, '200', '2026-10-05');
    m = await f.model(); expect(projectAccountBalances(m.transactions).map((entry) => entry.balance).sort((a,b) => a-b)).toEqual([20000, 80000]);
    expect(projectConsumption(m.transactions, m.categories, m.groups)).toMatchObject({ income: 0, expense: 0 });
    await f.move('undo'); expect((await f.model()).transactions).toHaveLength(1); await f.move('redo');
    m = await f.model(); const transfer = m.transferFor(m.transactions.find((entry) => entry.kind === 'transfer')!)!;
    await m.addTransfer(source!.id, target!.id, '300', '2026-10-05', undefined, false, transfer); await f.move('undo');
    m = await f.model(); await m.removeTransfer(m.transferFor(m.transactions.find((entry) => entry.kind === 'transfer')!)!); expect((await f.model()).transactions).toHaveLength(1);
    await f.move('undo'); m = await f.model();
    const ids = m.transactions.filter((entry) => entry.accountId === source!.id).map((entry) => entry.id);
    expect(m.difference(source!.id, '800', '2026-10-05', ids)).toBe(0);
    await m.reconcile(source!.id, '800', '2026-10-05', ids);
    m = await f.model(); await expect(m.removeTransaction(m.transactions.find((entry) => entry.kind === 'opening')!)).rejects.toThrow('entsperrt');
    await f.move('undo'); expect((await f.model()).transactions.every((entry) => entry.clearance === 'uncleared')).toBe(true);
    await f.move('redo'); m = await f.model();
    const targetIds = m.transactions.filter((entry) => entry.accountId === target!.id).map((entry) => entry.id);
    await m.reconcile(target!.id, '200', '2026-10-05', targetIds);
    m = await f.model();
    const missing = m.transactions.find((entry) => entry.kind === 'transfer' && entry.accountId === target!.id)!;
    const incomplete = (await f.read()).filter((entry) => entry.id !== missing.id);
    expect(() => unlockFinanceSelection(space, m.transactions.find((entry) => entry.kind === 'transfer')!.id, incomplete, m.domainDependencies)).toThrow('vollständigen Umbuchungsseiten');
    await m.unlock(m.transactions.find((entry) => entry.kind === 'transfer')!);
    m = await f.model(); expect(m.transactions.every((entry) => entry.clearance === 'cleared')).toBe(true);
    expect((await f.read()).filter((entry) => entry.aggregateType === 'reconciliation' && entry.deletedAt === undefined)).toHaveLength(0);
    await f.move('undo'); expect((await f.model()).transactions.every((entry) => entry.clearance === 'reconciled')).toBe(true);
    await f.move('redo'); expect((await f.model()).transactions.every((entry) => entry.clearance === 'cleared')).toBe(true);
  });
  it('weist Differenz, fehlende Geldfreigabe und Fremdänderungen ab und erhält die Historie nach Commitfehler', async () => {
    const f = await fixture(); await f.booking('1000', true); let m = await f.model();
    const before = await f.read(); await expect(m.reconcile(m.accounts[0]!.id, '999', '2026-10-05', [m.transactions[0]!.id])).rejects.toThrow(/differenz/i); expect(await f.read()).toEqual(before);
    await expect(m.addTransfer(m.accounts[2]!.id, m.accounts[0]!.id, '100', '2026-10-05')).rejects.toThrow('freigegeben');
    await m.addTransfer(m.accounts[0]!.id, m.accounts[2]!.id, '100', '2026-10-05', m.categories[0]!.id);
    f.fail(true); const transferBefore = await f.read(); await expect(f.move('undo')).rejects.toThrow('disk'); expect(await f.read()).toEqual(transferBefore); expect(f.history.canRedo).toBe(false);
    f.fail(false); await f.move('undo'); m = await f.model(); await m.addTransfer(m.accounts[2]!.id, m.accounts[0]!.id, '100', '2026-10-05', undefined, true);
    await f.stale((await f.read()).find((entry) => entry.aggregateType === 'transaction' && (entry as unknown as {kind: string}).kind === 'transfer' && entry.deletedAt === undefined)!);
    const foreign = await f.read(); await expect(f.move('undo')).rejects.toThrow(/aktuell|revision/i); expect(await f.read()).toEqual(foreign);
  });
  it('weist Redo bei veralteter Revision und Gegenbefehle in einem fremden Bereich ab', async () => {
    const f = await fixture(); await f.booking('-10'); await f.move('undo');
    const deleted = (await f.read()).find((entry) => entry.aggregateType === 'transaction')!; await f.stale(deleted);
    const before = await f.read(); await expect(f.move('redo')).rejects.toThrow(/aktuell|revision/i); expect(await f.read()).toEqual(before);
    await expect(f.history.move('redo', [], (await f.model()).domainDependencies, async () => { throw new Error('Darf nicht schreiben'); })).rejects.toThrow('Bereich');
    f.history.clear(); expect(f.history.canUndo).toBe(false); expect(f.history.canRedo).toBe(false);
  });
});
