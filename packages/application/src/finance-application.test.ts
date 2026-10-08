// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it, vi } from 'vitest';
import { FinanceApplication } from './finance-application.js';
import type { DomainChangeSet } from '@wimm/domain';
const id = '40000000-0000-4000-8000-000000000001';
const deps = { ids: { next: () => id }, clock: { now: () => '2026-10-08T12:00:00Z' } };
const change: DomainChangeSet = { spaceId: id, operationId: id, occurredAt: deps.clock.now(), commandType: 'account.save', expectedRevisions: [{ id, expectedRevision: 0 }], aggregates: [{ id, spaceId: id, revision: 1, aggregateType: 'account', createdAt: deps.clock.now(), updatedAt: deps.clock.now() }] };
it('behält bestätigte Änderung nach späterem Lesefehler ohne Wiederholungswrite', async () => {
  let reads = 0;
  const apply = vi.fn<() => Promise<void>>(async () => {});
  const app = new FinanceApplication(id, { query: async () => { if (++reads > 1) throw new Error('Lesefehler'); return []; }, applyAtomicBatch: apply }, deps, () => false);
  await app.load();
  await app.execute(change);
  expect(app.getSnapshot()).toMatchObject({ status: 'ready', message: 'Lokal gespeichert.', aggregates: [{ id, revision: 1 }] });
  await app.load();
  expect(app.getSnapshot()).toMatchObject({ status: 'error', aggregates: [{ id, revision: 1 }] });
  expect(apply).toHaveBeenCalledOnce();
});
it('blockiert Profilwechselkonflikt und erhält den Bestand bei Schreibfehler', async () => {
  let changing = true;
  const apply = vi.fn<() => Promise<void>>(async () => { throw new Error('Quota'); });
  const app = new FinanceApplication(id, { query: async () => [], applyAtomicBatch: apply }, deps, () => changing);
  await app.load();
  await expect(app.execute(change)).rejects.toThrow('Bereichswechsel');
  expect(apply).not.toHaveBeenCalled();
  changing = false;
  await expect(app.execute(change)).rejects.toThrow('Quota');
  expect(app.getSnapshot()).toMatchObject({ aggregates: [], saving: false, message: 'Die Eingaben wurden nicht gespeichert.' });
});
