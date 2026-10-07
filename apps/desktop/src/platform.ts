// SPDX-License-Identifier: AGPL-3.0-or-later
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { importFileLimits, validateImportSelection, type ImportedFile, type PlatformServices } from '@wimm/contracts';
import { createBrowserPlatformServices, validateExternalUrl } from '@wimm/ui';

export function createDesktopPlatformServices(): PlatformServices {
  // Browserprüfungen verwenden denselben expliziten Testfallback wie der Speicher.
  if (!('__TAURI_INTERNALS__' in window)) return createBrowserPlatformServices();
  const tokens = new Map<string, Uint8Array>();
  return {
    chooseImportFiles: async (request) => {
      const limits = importFileLimits(request);
      const files = await invoke<readonly (Omit<ImportedFile, 'bytes' | 'mediaType'> & { mediaType: string | null; bytes: number[] })[]>('platform_choose_files', { request: { ...request, ...limits } });
      validateImportSelection(files.map(file => file.bytes.length), limits);
      return files.map((file) => ({ ...file, mediaType: file.mediaType ?? undefined, bytes: new Uint8Array(file.bytes) }));
    },
    writeExport: async (request) => invoke('platform_write_file', { request: { ...request, bytes: Array.from(request.bytes) } }),
    openExternalUrl: async (url) => invoke('platform_open_url', { url: validateExternalUrl(url) }),
    setMenuCommands: async (commands) => invoke('platform_set_menu', { commands }),
    onMenuCommand: (handler) => listen<string>('platform-menu', ({ payload }) => handler(payload)),
    getDataDirectory: async () => undefined,
    // OS-Schlüsselspeicher folgt in P8; niemals ein Klartextdateifallback.
    secureTokens: { read: async (key) => tokens.get(key)?.slice(), write: async (key, value) => { tokens.set(key, value.slice()); }, remove: async (key) => { tokens.delete(key); } }
  };
}
