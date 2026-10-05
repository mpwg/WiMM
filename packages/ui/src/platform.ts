// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PlatformServices } from '@wimm/contracts';

export function validateExternalUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username !== '' || url.password !== '') throw new TypeError('Dieser Link ist nicht erlaubt.');
  return url.href;
}

export function isTextEditing(element: Element | null): boolean {
  return element instanceof HTMLElement && (element.isContentEditable || element.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])'));
}

/** Auswahl und Download nur als Folge einer ausdrücklichen Nutzeraktion. */
export function createBrowserPlatformServices(): PlatformServices {
  const tokens = new Map<string, Uint8Array>();
  return {
    chooseImportFiles: (request) => new Promise((resolve, reject) => {
      const input = document.createElement('input'); input.type = 'file'; input.multiple = request.multiple;
      input.accept = [...request.acceptedMediaTypes, ...request.acceptedExtensions.map((extension) => `.${extension.replace(/^\./, '')}`)].join(',');
      input.hidden = true; document.body.append(input);
      input.addEventListener('cancel', () => { input.remove(); resolve([]); }, { once: true });
      input.addEventListener('change', () => {
        const files = Array.from(input.files ?? []); input.remove();
        void Promise.all(files.map(async (file) => ({ name: file.name, mediaType: file.type || undefined, bytes: new Uint8Array(await file.arrayBuffer()) }))).then(resolve, reject);
      }, { once: true });
      input.click();
    }),
    writeExport: async (request) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(request.bytes)], { type: request.mediaType }));
      const link = document.createElement('a'); link.href = url; link.download = request.suggestedName; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    openExternalUrl: async (url) => { window.open(validateExternalUrl(url), '_blank', 'noopener,noreferrer'); },
    onMenuCommand: async () => () => undefined,
    setMenuCommands: async () => undefined,
    getDataDirectory: async () => undefined,
    secureTokens: { read: async (key) => tokens.get(key)?.slice(), write: async (key, value) => { tokens.set(key, value.slice()); }, remove: async (key) => { tokens.delete(key); } }
  };
}
