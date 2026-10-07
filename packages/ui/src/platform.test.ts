// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { validateExternalUrl } from './platform.js';
describe('Externe Links', () => {
  it('erlaubt Weblinks und lehnt aktive/lokale Schemata sowie Credentials ab', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:secret@example.org', 'tauri://localhost', 'kein Link']) expect(() => validateExternalUrl(value)).toThrow(/Link|Invalid URL/);
    expect(validateExternalUrl('https://github.com/mpwg/WiMM')).toBe('https://github.com/mpwg/WiMM');
  });
});

import { afterEach, vi } from 'vitest';
import { createBrowserPlatformServices } from './platform.js';
afterEach(() => { vi.unstubAllGlobals(); });
const maxBytes = 25 * 1024 * 1024;
function selectedFiles(files: readonly { size: number; name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }[]) {
  const input = Object.assign(new EventTarget(), { files, remove() {}, click() { queueMicrotask(() => input.dispatchEvent(new Event('change'))); } });
  vi.stubGlobal('document', { createElement: () => input, body: { append() {} } });
}
it('weist übergroße Dateien und Auswahlbudgets vor arrayBuffer ab', async () => {
  const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>(async () => new ArrayBuffer(1));
  const request = { multiple: true, acceptedExtensions: ['csv'], acceptedMediaTypes: [], maxBytes, maxFiles: 2, maxTotalBytes: maxBytes };
  for (const sizes of [[maxBytes + 1], [1, 1, 1], [maxBytes, 1]]) {
    selectedFiles(sizes.map(size => ({ size, name: 'synthetisch.csv', type: '', arrayBuffer })));
    await expect(createBrowserPlatformServices().chooseImportFiles(request)).rejects.toThrow(/Grenze|Limit|MiB/i); expect(arrayBuffer).not.toHaveBeenCalled();
  }
});
it('liest Dateien genau an der Grenze und kleine gültige Dateien', async () => {
  const request = { multiple: false, acceptedExtensions: ['csv'], acceptedMediaTypes: [], maxBytes };
  for (const size of [1, maxBytes]) {
    const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>(async () => new ArrayBuffer(size)); selectedFiles([{ size, name: 'synthetisch.csv', type: '', arrayBuffer }]);
    expect((await createBrowserPlatformServices().chooseImportFiles(request))[0]?.bytes.byteLength).toBe(size); expect(arrayBuffer).toHaveBeenCalledOnce();
  }
});
