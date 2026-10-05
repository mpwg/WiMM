// SPDX-License-Identifier: AGPL-3.0-or-later
import { createDesktopPlatformServices } from './platform.js';
import { invoke } from '@tauri-apps/api/core';
import { AppShell, createBrowserProfileStore, type WorkspaceStorage } from '@wimm/ui';
import { createTauriStorageBridge, IndexedDbStorageAdapter } from '@wimm/storage';
import type { UUID } from '@wimm/contracts';

// Das getrennte Modul vor dem Einstieg laden: nach SW-Kontrolle wird es so
// auch bei einem Neustart in den Sperrbildschirm vollständig gecacht.
const { FinanceWorkspace } = await import('@wimm/ui/workspace');
const profileStore = createBrowserProfileStore(import.meta.env.VITE_WIMM_NATIVE_SMOKE === '1' ? (import.meta.env.VITE_WIMM_NATIVE_SMOKE_PROFILE ?? 'wimm/native-smoke-profile/v1') : 'wimm/desktop-profile/v1');
const platform = createDesktopPlatformServices();

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
