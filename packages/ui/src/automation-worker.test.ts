// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { FinanceModel } from './workspace.js';
import { AutomationModel } from './automation-model.js';
import type { ImportBatchAggregate } from '@wimm/domain';
const space = '00000000-0000-4000-8000-000000000001';
const batch: ImportBatchAggregate = { id: '00000000-0000-4000-8000-000000000002', spaceId: space, aggregateType: 'importBatch', revision: 1, createdAt: '2026-10-07T12:00:00Z', updatedAt: '2026-10-07T12:00:00Z', accountId: '00000000-0000-4000-8000-000000000003', fileHash: 'a'.repeat(64), rows: [], committedRows: [], state: 'ready' };
afterEach(() => vi.unstubAllGlobals());
function setup(postMessage: (this: { onmessage: ((event: MessageEvent) => void) | null }) => void) {
  const terminate = vi.fn<() => void>(); let active: (() => { onmessage: ((event: MessageEvent) => void) | null }) | undefined;
  class WorkerFixture { onmessage = null; onerror = null; onmessageerror = null; terminate = terminate; postMessage = postMessage; constructor() { active = () => this; } }
  vi.stubGlobal('Worker', WorkerFixture);
  const commit = vi.fn<() => Promise<void>>(async () => {});
  return { model: new AutomationModel(new FinanceModel(space, [], commit)), terminate, commit, active: () => active?.() };
}
it('räumt synchronen postMessage-Fehler auf und committet nichts', async () => {
  const f = setup(function () { throw new Error('Clonefehler'); });
  await expect(f.model.next(batch)).rejects.toThrow('Worker'); expect(f.terminate).toHaveBeenCalledOnce(); expect(f.commit).not.toHaveBeenCalled();
});
it('Abbruch terminiert den Commitworker und ignoriert späte Antworten vor dem Write', async () => {
  const f = setup(function () {}); const controller = new AbortController();
  const pending = f.model.next(batch, controller.signal); const result = pending.catch((error: unknown) => error);
  controller.abort(); f.active()?.onmessage?.({ data: { change: { commandType: 'import.commit' } } } as MessageEvent);
  const error = await result; expect(error instanceof Error && error.message.includes('abgebrochen')).toBe(true);
  expect(f.terminate).toHaveBeenCalledOnce(); expect(f.commit).not.toHaveBeenCalled();
});

it('Zeitlimit terminiert die Vorbereitung und spätes Ergebnis erzeugt keinen Write', async () => {
  vi.useFakeTimers();
  try {
    const f = setup(function () {});
    const result = f.model.next(batch).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    f.active()?.onmessage?.({ data: { change: { commandType: 'import.commit' } } } as MessageEvent);
    const error = await result;
    expect(error instanceof Error && error.message.includes('Zeitlimit')).toBe(true);
    expect(f.terminate).toHaveBeenCalledOnce();
    expect(f.commit).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
