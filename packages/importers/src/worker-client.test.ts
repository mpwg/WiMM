// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { createImportWorkerPort } from './worker-client.js';
afterEach(() => { vi.useRealTimers(); });
function worker() { return { onmessage: null as ((event: MessageEvent) => void) | null, onerror: null, onmessageerror: null, terminate: vi.fn<() => void>(), postMessage: vi.fn<(message: unknown) => void>() }; }
it('beendet hängende Worker automatisch und erlaubt einen Neustart', async () => {
  vi.useFakeTimers(); const first = worker(); const next = worker(); const factory = vi.fn<() => Worker>().mockReturnValueOnce(first as unknown as Worker).mockReturnValueOnce(next as unknown as Worker);
  const port = createImportWorkerPort(factory); const pending = port.parse({ bytes: new Uint8Array(1), format: 'csv' });
  const outcome = pending.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(30_001); const reason = await outcome; expect(reason instanceof Error && /Zeit|Limit/.test(reason.message)).toBe(true); expect(first.terminate).toHaveBeenCalledOnce();
  const restarted = port.parse({ bytes: new Uint8Array(1), format: 'csv' }); next.onmessage?.({ data: { ok: true, result: { format: 'csv', records: [] } } } as MessageEvent);
  expect((await restarted).records).toEqual([]); expect(vi.getTimerCount()).toBe(0);
});
it('klont ausschließlich die sichtbaren Dateibytes und räumt postMessage-Fehler auf', async () => {
  const w = worker(); const post = vi.mocked(w.postMessage); post.mockImplementation(() => { throw new Error('synthetisch'); });
  const bytes = new Uint8Array(new ArrayBuffer(1024), 12, 1);
  await expect(createImportWorkerPort(() => w as unknown as Worker).parse({ bytes, format: 'csv' })).rejects.toThrow('Importworker');
  const dispatched = post.mock.calls[0]![0] as { bytes: Uint8Array }; expect(dispatched.bytes.buffer.byteLength).toBe(1); expect(w.terminate).toHaveBeenCalledOnce();
});

it('started verlängert die Frist nicht; Abbruch ignoriert späte Antworten und löscht Timer', async () => {
  vi.useFakeTimers(); const w = worker(); const controller = new AbortController();
  const pending = createImportWorkerPort(() => w as unknown as Worker).parse({ bytes: new Uint8Array(1), format: 'csv' }, controller.signal);
  const outcome = pending.catch((error: unknown) => error);
  w.onmessage?.({ data: { started: true } } as MessageEvent); controller.abort();
  w.onmessage?.({ data: { ok: true, result: { format: 'csv', records: [] } } } as MessageEvent);
  const reason = await outcome; expect(reason instanceof Error && reason.message.includes('abgebrochen')).toBe(true); expect(w.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
