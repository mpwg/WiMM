// SPDX-License-Identifier: AGPL-3.0-or-later
import { invoke } from '@tauri-apps/api/core';
import { AppShell, createBrowserProfileStore, FinanceWorkspace, type WorkspaceStorage } from '@wimm/ui';
import { createTauriStorageBridge, IndexedDbStorageAdapter } from '@wimm/storage';
import type { PlatformServices, UUID } from '@wimm/contracts';

const profileStore = createBrowserProfileStore('wimm/desktop-profile/v1');
const platform = createDesktopPlatformServices();

/**
 * Der Desktop übergibt einen eigenen Systemport. Noch nicht in P4.1 verdrahtete
 * Datei-, Menü- und Linkbefehle können damit nicht versehentlich den
 * Browserstandard verwenden; ihre native Umsetzung folgt konzentriert in P4.5.
 */
function createDesktopPlatformServices(): PlatformServices {
  const tokens = new Map<string, Uint8Array>();
  const unavailable = async (): Promise<never> => { throw new Error('Diese native Systemfunktion wird noch nicht bereitgestellt.'); };
  return {
    chooseImportFiles: unavailable,
    writeExport: unavailable,
    openExternalUrl: unavailable,
    setMenuCommands: async () => undefined,
    getDataDirectory: async () => undefined,
    secureTokens: {
      read: async (key) => tokens.get(key)?.slice(),
      write: async (key, value) => { tokens.set(key, value.slice()); },
      remove: async (key) => { tokens.delete(key); }
    }
  };
}
function createDesktopWorkspaceStorage(profileId: UUID): WorkspaceStorage {
  // Die Playwright-Frontendprüfung läuft absichtlich ohne Tauri-Laufzeit. Die
  // Produktanwendung verwendet dort niemals den Browserfallback.
  if ('__TAURI_INTERNALS__' in window) {
    const bridge = createTauriStorageBridge(invoke);
    return {
      query: ({ spaceId }) => bridge.queryAggregates(profileId, spaceId),
      applyAtomicBatch: (batch) => bridge.applyBatch({ profileId, ...batch })
    };
  }
  return new IndexedDbStorageAdapter(profileId, `wimm-ui-desktop-frontend-test-${profileId}`);
}

export function App() {
  return <AppShell platform={platform} store={profileStore} title="WhereIsMyMoney für den Schreibtisch">{(context) => <FinanceWorkspace context={context} storageForProfile={createDesktopWorkspaceStorage} desktop />}</AppShell>;
}
