// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich Vite-Testseite; kein Produktionsentry und keine Fehlerports in der App.
import { createBrowserApplicationRuntime } from '@wimm/browser-adapters';
import { ProfileApplication, ApplicationActivity } from '@wimm/application';
import { FinanceWorkspace } from '@wimm/ui/workspace';
import { createRoot } from 'react-dom/client';
import { createBrowserPlatformServices, type UnlockedAppContext, type WorkspaceStorage } from '@wimm/ui';
import { IndexedDbStorageAdapter, toStoredAggregate, type StoredAggregate } from '@wimm/storage';
import type { AtomicBatch, UUID } from '@wimm/contracts';
import type { AccountAggregate, CategoryGroupAggregate, CategoryAggregate, P2Aggregate, TransactionAggregate } from '@wimm/domain';
import '../src/styles.css';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}` as UUID;
const profileId = id(1), spaceId = id(2), accountId = id(3), groupId = id(4), categoryId = id(5);
const meta = (value: number) => ({ id: id(value), spaceId, revision: 1, createdAt: '2026-10-04T12:00:00Z', updatedAt: '2026-10-04T12:00:00Z' }) as const;
const parameters = new URLSearchParams(location.search);
const adapter = new IndexedDbStorageAdapter(profileId, 'wimm-workspace-integration');
const count = Number(parameters.get('count') ?? 3);
const performanceFixture = parameters.get('performance') === 'true';
const matrixFixture = parameters.get('matrix') === 'true';
// Beim Neustart nur das bekannte Startkonto prüfen; keine zweite Vollabfrage
// oder erneute Erzeugung der bereits gespeicherten 50.000 Testbuchungen.
if (await adapter.readAggregate(accountId) === undefined) {
  const initial: P2Aggregate[] = [
    { ...meta(3), aggregateType: 'account', name: 'Testkonto', type: 'checking', onBudget: true, archived: false } as AccountAggregate,
    { ...meta(4), aggregateType: 'categoryGroup', name: 'Testgruppe', kind: 'expense', sortOrder: 0, archived: false } as CategoryGroupAggregate,
    { ...meta(5), aggregateType: 'category', name: 'Testkategorie', groupId, sortOrder: 0, archived: false } as CategoryAggregate
  ];
  for (let index = 0; index < count; index += 1) initial.push({
    ...meta(100 + index), aggregateType: 'transaction', kind: 'normal', accountId, amount: -100,
    date: '2026-10-04', clearance: count === 3 && index === 2 ? 'reconciled' : 'uncleared',
    note: `Buchung ${String(index).padStart(5, '0')}`, splits: [{ id: id(100000 + index), categoryId, amount: -100 }]
  } as TransactionAggregate);
  if (parameters.get('p44') === 'true') {
    initial.splice(3);
    initial.push({ ...meta(6), aggregateType: 'account', name: 'Zielkonto', type: 'cash', onBudget: true, archived: false } as AccountAggregate);
    initial.push({ ...meta(7), aggregateType: 'account', name: 'Extern', type: 'savings', onBudget: false, archived: false } as AccountAggregate);
    initial.push({ ...meta(8), aggregateType: 'transaction', accountId, date: '2026-10-05', amount: 100000, kind: 'opening', clearance: 'uncleared', splits: [] } as TransactionAggregate);
  }
  // P4.6-Datensätze bleiben ausschließlich in der getrennten Testseite.
  if (performanceFixture) {
    for (let index = 1; index < 10; index++) initial.push({ ...meta(60000 + index), aggregateType: 'account', name: `Konto ${index}`, type: 'checking', onBudget: true, archived: false } as AccountAggregate);
    for (let index = 1; index < 100; index++) initial.push({ ...meta(61000 + index), aggregateType: 'category', name: `Kategorie ${index}`, groupId, sortOrder: index, archived: false } as CategoryAggregate);
    for (const entry of initial) if (entry.aggregateType === 'transaction') {
      const index = Number(entry.id.slice(-12)) - 100;
      const month = index % 36;
      Object.assign(entry, { accountId: index % 10 === 0 ? accountId : id(60000 + index % 10), date: `${2024 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-05`, splits: [{ id: id(100000 + index), categoryId: index % 100 === 0 ? categoryId : id(61000 + index % 100), amount: -100 }] });
    }
  }
  if (matrixFixture) {
    Object.assign(initial[0]!, { name: 'Gemeinschaftliches Rücklagenkonto für außergewöhnliche Familienausgaben' });
    Object.assign(initial[2]!, { name: 'AußergewöhnlicheHaushaltsausgabenUndFamilienrücklagen' });
    for (const entry of initial) if (entry.aggregateType === 'transaction') Object.assign(entry, { amount: -123456789, note: 'Österreichische Gemeinschaftsbäckerei mit außergewöhnlich langer Bezeichnung', splits: [{ id: id(100000), categoryId, amount: -123456789 }] });
  }
  await adapter.applyAtomicBatch({ expectedRevisions: [], aggregates: initial.map(toStoredAggregate), outbox: [], projections: performanceFixture ? Array.from({ length: 1000 }, (_, index) => ({ spaceId, kind: 'synthetic-shared-expense-load', key: String(index), payload: { id: id(200000 + index), amount: 100, source: 'private_advance', reimbursementSource: 'household', categoryId, shares: [{ participantId: id(300000), amount: 50 }, { participantId: id(300001), amount: 50 }] } })) : [] });
}
let mode = 'normal'; let release: (() => void) | undefined;
const storage: WorkspaceStorage = {
  query: (query) => adapter.query(query),
  applyAtomicBatch: async (batch) => {
    if (mode === 'delay') await new Promise<void>((resolve) => { release = resolve; });
    if (mode === 'quota') throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    if (mode === 'disk') throw new Error('SQLite disk full');
    if (mode === 'native-disk') throw 'Speicherfehler: database or disk is full';
    if (mode === 'partial') {
      // Der letzte Put besitzt einen ungültigen Schlüssel: Dexie muss auch die
      // vorher geschriebenen Transfer-/Abgleichzeilen in derselben Transaktion zurückrollen.
      const invalid = { ...batch, aggregates: batch.aggregates.map((entry, index) => index === batch.aggregates.length - 1 ? { ...entry, handle: undefined } : entry) } as unknown as AtomicBatch<StoredAggregate, never, never>;
      await adapter.applyAtomicBatch(invalid); return;
    }
    await adapter.applyAtomicBatch(batch);
  }
};
declare global { interface Window { workspaceTest: {
  mode(value: string): void; release(): void; read(): Promise<readonly StoredAggregate[]>; stale(id: string): Promise<void>; fixture(): Promise<{ transactions: number; accounts: number; categories: number; months: number; sharedExpenseLoad: number }>;
} } }
window.workspaceTest = {
  mode(value) { mode = value; }, release() { release?.(); }, read: () => adapter.query({ spaceId }),
  async fixture() {
    const aggregates = await adapter.query({ spaceId });
    const sharedExpenseLoad = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('wimm-workspace-integration');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const query = database.transaction('projections').objectStore('projections').getAll();
        query.onerror = () => { database.close(); reject(query.error); };
        query.onsuccess = () => { const entries = query.result as { kind: string }[]; database.close(); resolve(entries.filter((entry) => entry.kind === 'synthetic-shared-expense-load').length); };
      };
    });
    const transactions = aggregates.filter((entry) => entry.aggregateType === 'transaction') as unknown as TransactionAggregate[];
    return { transactions: transactions.length, accounts: aggregates.filter((entry) => entry.aggregateType === 'account').length, categories: aggregates.filter((entry) => entry.aggregateType === 'category').length, months: new Set(transactions.map((entry) => entry.date.slice(0, 7))).size, sharedExpenseLoad };
  },
  async stale(transactionId) {
    const transaction = await adapter.readAggregate(transactionId as UUID);
    if (transaction === undefined) throw new Error('Testbuchung fehlt');
    await adapter.applyAtomicBatch({ expectedRevisions: [{ handle: transaction.handle, expectedRevision: transaction.revision }],
      aggregates: [{ ...transaction, revision: transaction.revision + 1, note: 'Zwischenzeitlich geändert' } as StoredAggregate], outbox: [], projections: [] });
  }
};
const area = { id: spaceId, kind: 'private', label: 'Synthetischer Bereich' } as const;
const profileApplication = new ProfileApplication({ load: async () => ({ kind: 'missing' }), change: async () => { throw new Error('Keine Profiländerung im Finanzfixture'); } }, { next: () => crypto.randomUUID() }, new ApplicationActivity());
const runtime = createBrowserApplicationRuntime(() => storage, profileApplication);
const context = { runtime, activity: profileApplication.activity, profileChanging: false, isProfileChanging: () => false, platform: createBrowserPlatformServices(), activeArea: area, profile: { profileId, areas: [area] }, selectArea: () => undefined, createHousehold: async () => undefined, lock: async () => undefined } as unknown as UnlockedAppContext;
createRoot(document.getElementById('root')!).render(<FinanceWorkspace context={context} desktop={parameters.get('desktop') === 'true'} />);
