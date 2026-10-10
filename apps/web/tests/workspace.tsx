// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich Vite-Testseite; kein Produktionsentry und keine Fehlerports in der App.
import { createBrowserApplicationRuntime,BrowserSqliteStorageAdapter } from '@wimm/browser-adapters';
import { ProfileApplication, ApplicationActivity } from '@wimm/application';
import { FinanceWorkspace } from '@wimm/ui/workspace';
import { createRoot } from 'react-dom/client';
import { createBrowserPlatformServices, type UnlockedAppContext, type WorkspaceStorage } from '@wimm/ui';
import { StorageFailureError, toStoredAggregate, type StoredAggregate } from '@wimm/storage';
import type { AtomicBatch, UUID } from '@wimm/contracts';
import type { AccountAggregate, CategoryGroupAggregate, CategoryAggregate, P2Aggregate, TransactionAggregate } from '@wimm/domain';
import '../src/styles.css';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}` as UUID;
const profileId = id(1), spaceId = id(2), accountId = id(3), groupId = id(4), categoryId = id(5);
const meta = (value: number) => ({ id: id(value), spaceId, revision: 1, createdAt: '2026-10-04T12:00:00Z', updatedAt: '2026-10-04T12:00:00Z' }) as const;
const parameters = new URLSearchParams(location.search);
const adapter = new BrowserSqliteStorageAdapter(profileId);
const count = Number(parameters.get('count') ?? 3);
const performanceFixture = parameters.get('performance') === 'true';
const matrixFixture = parameters.get('matrix') === 'true';
await adapter.initializeArea(spaceId,id(9));
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
  await adapter.applyAtomicBatch({ expectedRevisions: [], aggregates: initial.map(toStoredAggregate), outbox: performanceFixture ? Array.from({ length: 1000 }, (_, index) => ({ operationId:id(200000+index),spaceId,expectedRevisions:[],dependsOn:[],state:'blocked' as const,retryCount:0,createdAt:meta(0).createdAt,draft:{syntheticSharedExpenseLoad:true,id:id(200000+index),amount:100,source:'private_advance',reimbursementSource:'household',categoryId,shares:[{participantId:id(300000),amount:50},{participantId:id(300001),amount:50}]} })) : [], projections: [] });
}
let mode = 'normal'; let release: (() => void) | undefined;
let coldListPaintedAt: number | undefined;
const storage: WorkspaceStorage = {
  query: (query) => adapter.query(query),
  applyAtomicBatch: async (batch) => {
    if (mode === 'delay') await new Promise<void>((resolve) => { release = resolve; });
    if (mode === 'quota') throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    if (mode === 'disk') throw new StorageFailureError('QUOTA', 'notCommitted');
    if (mode === 'native-disk') throw new StorageFailureError('QUOTA', 'notCommitted');
    if (mode === 'partial') {
      // Ungültiger letzter Handle prüft die UI-Originalerhaltung; tatsächliche
      // SQL-Rollbacks nach begonnenen Writes werden separat nativ geprüft.
      const invalid = { ...batch, aggregates: batch.aggregates.map((entry, index) => index === batch.aggregates.length - 1 ? { ...entry, handle: undefined } : entry) } as unknown as AtomicBatch<StoredAggregate, never, never>;
      await adapter.applyAtomicBatch(invalid); return;
    }
    await adapter.applyAtomicBatch(batch);
  }
};
declare global { interface Window { workspaceTest: {
  mode(value: string): void; release(): void; read(): Promise<readonly StoredAggregate[]>; stale(id: string): Promise<void>; coldListPaintedAt(): number | undefined; fixture(): Promise<{ transactions: number; accounts: number; categories: number; months: number; sharedExpenseLoad: number }>;
} } }
window.workspaceTest = {
  coldListPaintedAt: () => coldListPaintedAt,
  mode(value) { mode = value; }, release() { release?.(); }, read: () => adapter.query({ spaceId }),
  async fixture() {
    const aggregates = await adapter.query({ spaceId });
    const sharedExpenseLoad=(await adapter.loadPending(spaceId)).filter(entry=>typeof entry.draft==='object'&&entry.draft!==null&&'syntheticSharedExpenseLoad' in entry.draft&&entry.draft.syntheticSharedExpenseLoad===true).length;
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
const rootElement = document.getElementById('root')!;
if (performanceFixture) {
  // Navigationszeit bis zur ersten tatsächlich dargestellten vollständigen Liste.
  // Die Playwright-Poll-/Transportzeit nach der Darstellung gehört nicht zur Appzeit.
  const visibleList = () => {
    const counter = rootElement.querySelector('[data-transaction-count]');
    const row = rootElement.querySelector('tr[data-transaction-id]');
    return counter?.textContent === `${count} Buchungen` && row !== null && row.getBoundingClientRect().height > 0;
  };
  let awaitingPaint = false;
  const observer = new MutationObserver(() => {
    if (awaitingPaint || !visibleList()) return;
    awaitingPaint = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (visibleList()) { coldListPaintedAt = performance.now(); observer.disconnect(); }
      else awaitingPaint = false;
    }));
  });
  observer.observe(rootElement, { subtree: true, childList: true, characterData: true, attributes: true });
}
createRoot(rootElement).render(<FinanceWorkspace context={context} desktop={parameters.get('desktop') === 'true'} />);
