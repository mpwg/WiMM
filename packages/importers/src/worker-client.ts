// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImportFailure, MAX_IMPORT_BYTES, IMPORT_WORKER_TIMEOUT_MS } from './types.js';
import type { ParseRequest, ParseResult } from './types.js';
import type { WorkerMessage } from './worker.js';

export interface ImportWorkerPort {
  parse(request: ParseRequest, signal?: AbortSignal): Promise<ParseResult>;
}
/** Factory wird im App-Bundler mit new Worker(new URL(...), { type: 'module' }) bereitgestellt. */
export function createImportWorkerPort(factory: () => Worker): ImportWorkerPort {
  return {
    parse(request, signal) {
      if (signal?.aborted) return Promise.reject(new ImportFailure({ code: 'ABORTED', message: 'Der Import wurde abgebrochen.' }));
      if (request.bytes.byteLength > MAX_IMPORT_BYTES) return Promise.reject(new ImportFailure({ code: 'FILE_LIMIT', message: 'Die Datei ist größer als 25 MiB.' }));
      return new Promise((resolve, reject) => {
        const worker = factory();
        let settled = false;
        const timeout = setTimeout(() => { if (settled) return; cleanup(); reject(new ImportFailure({ code: 'WORKER_ERROR', message: 'Der Import überschreitet das Zeitlimit. Bitte prüfen Sie die Dateigröße.' })); }, IMPORT_WORKER_TIMEOUT_MS);
        const cleanup = (): void => { settled = true; clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate(); };
        const abort = (): void => { if (settled) return; cleanup(); reject(new ImportFailure({ code: 'ABORTED', message: 'Der Import wurde abgebrochen.' })); };
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          if (settled || 'started' in event.data) return;
          cleanup();
          if (event.data.ok) resolve(event.data.result);
          else reject(new ImportFailure(event.data.issue));
        };
        const failed = (): void => { if (settled) return; cleanup(); reject(new ImportFailure({ code: 'WORKER_ERROR', message: 'Der Importworker konnte nicht ausgeführt werden.' })); };
        worker.onerror = failed;
        worker.onmessageerror = failed;
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        try { worker.postMessage({ ...request, bytes: request.bytes.slice() }); } catch { failed(); }
      });
    }
  };
}
