// SPDX-License-Identifier: AGPL-3.0-or-later
import { createImportWorkerPort } from '@wimm/importers';
// Konkreter Browseradapter für injizierte Anwendungsports.
import { FinanceModel as ApplicationFinanceModel, AutomationModel as ApplicationAutomationModel, type ImportPreparationInput, type ImportPreviewInput, type ImportPreviewOutput, FinanceApplication, type ProfileApplication, type WorkspaceStorageFactory, type ApplicationRuntime } from '@wimm/application';
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

export const browserImportPreview: BackgroundExecutionPort<ImportPreviewInput, ImportPreviewOutput> = {
  async execute(input, cancellation) {
    const controller = new AbortController();
    const stop = cancellation.onCancel(() => controller.abort());
    try {
      if (cancellation.isCancelled()) controller.abort();
      const port = createImportWorkerPort(() => new Worker(new URL('./import-worker.ts', import.meta.url), { type: 'module' }));
      const parsed = await port.parse({ bytes: input.file.bytes, format: input.format, encoding: input.mapping.encoding, separator: input.mapping.separator, mapping: input.mapping, preview: true }, controller.signal);
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(input.file.bytes));
      return { fileHash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''), rows: parsed.preview ?? [] };
    } finally { stop(); }
  }
};
export function createBrowserApplicationRuntime(storageForProfile: WorkspaceStorageFactory, profile: ProfileApplication,options:Pick<ApplicationRuntime,'persistence'>={}): ApplicationRuntime {
  const dependencies = browserDomainDependencies();
  return { ...options,dependencies, importPreparation: browserImportPreparation, importPreview: browserImportPreview, financeForScope(profileId, spaceId) { return new FinanceApplication(spaceId, storageForProfile(profileId), dependencies, profile.isChanging, profile.activity); } };
}
