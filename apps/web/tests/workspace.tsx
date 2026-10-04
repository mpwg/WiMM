// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich Vite-Testseite; kein Produktionsentry und keine Fehlerports in der App.
import { createRoot } from 'react-dom/client';
import { FinanceWorkspace, type UnlockedAppContext, type WorkspaceStorage } from '@wimm/ui';
import { IndexedDbStorageAdapter, toStoredAggregate, type StoredAggregate } from '@wimm/storage';
import type { UUID } from '@wimm/contracts';
import type { AccountAggregate, CategoryGroupAggregate, CategoryAggregate, P2Aggregate, TransactionAggregate } from '@wimm/domain';
import '../src/styles.css';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}` as UUID;
const profileId = id(1), spaceId = id(2), accountId = id(3), groupId = id(4), categoryId = id(5);
const meta = (value: number) => ({ id: id(value), spaceId, revision: 1, createdAt: '2026-10-04T12:00:00Z', updatedAt: '2026-10-04T12:00:00Z' }) as const;
const parameters = new URLSearchParams(location.search);
const adapter = new IndexedDbStorageAdapter(profileId, 'wimm-workspace-integration');
const count = Number(parameters.get('count') ?? 3);
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
await adapter.applyAtomicBatch({ expectedRevisions: [], aggregates: initial.map(toStoredAggregate), outbox: [], projections: [] });
let mode = 'normal'; let release: (() => void) | undefined;
const storage: WorkspaceStorage = {
  query: (query) => adapter.query(query),
  applyAtomicBatch: async (batch) => {
    if (mode === 'delay') await new Promise<void>((resolve) => { release = resolve; });
    if (mode === 'quota') throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    if (mode === 'disk') throw new Error('SQLite disk full');
    await adapter.applyAtomicBatch(batch);
  }
};
declare global { interface Window { workspaceTest: {
  mode(value: string): void; release(): void; read(): Promise<readonly StoredAggregate[]>; stale(id: string): Promise<void>;
} } }
window.workspaceTest = {
  mode(value) { mode = value; }, release() { release?.(); }, read: () => adapter.query({ spaceId }),
  async stale(transactionId) {
    const transaction = await adapter.readAggregate(transactionId as UUID);
    if (transaction === undefined) throw new Error('Testbuchung fehlt');
    await adapter.applyAtomicBatch({ expectedRevisions: [{ handle: transaction.handle, expectedRevision: transaction.revision }],
      aggregates: [{ ...transaction, revision: transaction.revision + 1, note: 'Zwischenzeitlich geändert' } as StoredAggregate], outbox: [], projections: [] });
  }
};
const area = { id: spaceId, kind: 'private', label: 'Synthetischer Bereich' } as const;
const context = { activeArea: area, profile: { profileId, areas: [area] }, selectArea: () => undefined, createHousehold: async () => undefined, lock: async () => undefined } as unknown as UnlockedAppContext;
createRoot(document.getElementById('root')!).render(<FinanceWorkspace context={context} storageForProfile={() => storage} desktop={parameters.get('desktop') === 'true'} />);
