// SPDX-License-Identifier: AGPL-3.0-or-later
import { createImportWorkerPort } from '../src/index.js';
export const port = createImportWorkerPort(() => new Worker(new URL('../src/worker-entry.ts', import.meta.url), { type: 'module' }));

export async function abortRunningImport(): Promise<string> {
  const controller = new AbortController();
  const runningPort = createImportWorkerPort(() => {
    const worker = new Worker(new URL('../src/worker-entry.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (event.data && typeof event.data === 'object' && 'started' in event.data) controller.abort();
    });
    return worker;
  });
  try { await runningPort.parse({ bytes: new TextEncoder().encode('x'.repeat(25 * 1024 * 1024)), format: 'csv' }, controller.signal); }
  catch (error) { return (error as { issue: { code: string } }).issue.code; }
  return 'UNEXPECTED_SUCCESS';
}
