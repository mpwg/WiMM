// SPDX-License-Identifier: AGPL-3.0-or-later
// Vorläufiger Browseradapter; die endgültige App-Composition folgt im K02-Abschluss.
import { FinanceModel as ApplicationFinanceModel, AutomationModel as ApplicationAutomationModel, type ImportPreparationInput } from '@wimm/application';
import type { UUID, CancellationPort, BackgroundExecutionPort } from '@wimm/contracts';
import type { StoredAggregate } from '@wimm/storage';
import type { DomainChangeSet, DomainDependencies } from '@wimm/domain';
export const browserDomainDependencies = (): DomainDependencies => ({ ids: { next: () => crypto.randomUUID() as UUID }, clock: { now: () => new Date().toISOString() } });
export class FinanceModel extends ApplicationFinanceModel {
  constructor(spaceId: UUID, aggregates: readonly StoredAggregate[], execute: (change: DomainChangeSet) => Promise<void>, dependencies = browserDomainDependencies()) { super(spaceId, aggregates, execute, dependencies); }
}
export function cancellationForSignal(signal?: AbortSignal): CancellationPort {
  return { isCancelled: () => signal?.aborted ?? false, onCancel(handler) { signal?.addEventListener('abort', handler, { once: true }); return () => signal?.removeEventListener('abort', handler); } };
}
export const browserImportPreparation: BackgroundExecutionPort<ImportPreparationInput, DomainChangeSet | null> = {
  execute(input, cancellation) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./commit-worker.ts', import.meta.url), { type: 'module' });
      let settled = false;
      const cleanup = () => { settled = true; clearTimeout(timeout); stop(); worker.terminate(); };
      const fail = (message: string) => { if (settled) return; cleanup(); reject(new Error(message)); };
      const timeout = setTimeout(() => fail('Die Importgruppe überschreitet das Zeitlimit.'), 30_000);
      let stop = () => {};
      stop = cancellation.onCancel(() => fail('Die Importgruppe wurde abgebrochen.'));
      worker.onmessage = (event: MessageEvent<{ change?: DomainChangeSet | null; error?: string }>) => {
        if (settled) return;
        cleanup(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.change ?? null);
      };
      worker.onerror = () => fail('Die Importgruppe konnte nicht vorbereitet werden.');
      worker.onmessageerror = () => fail('Die Importgruppe konnte nicht gelesen werden.');
      if (cancellation.isCancelled()) { fail('Die Importgruppe wurde abgebrochen.'); return; }
      try { worker.postMessage(input); } catch { fail('Die Importgruppe konnte nicht an den Worker übergeben werden.'); }
    });
  }
};
export class AutomationModel extends ApplicationAutomationModel {
  constructor(finance: ApplicationFinanceModel, preparation = browserImportPreparation) { super(finance, preparation); }
  override next(batch: ImportPreparationInput['batch'], signal?: AbortSignal | CancellationPort) { return super.next(batch, signal !== undefined && 'isCancelled' in signal ? signal : cancellationForSignal(signal)); }
}
