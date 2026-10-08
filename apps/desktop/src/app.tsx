// SPDX-License-Identifier: AGPL-3.0-or-later
import { createBrowserProfileStore, createBrowserApplicationRuntime } from '@wimm/browser-adapters';
import { ProfileApplication, ApplicationActivity } from '@wimm/application';
import { createDesktopPlatformServices } from './platform.js';
import { invoke } from '@tauri-apps/api/core';
import { AppShell, type WorkspaceStorage } from '@wimm/ui';
import { createTauriStorageBridge, DesktopStorageAdapter, IndexedDbStorageAdapter } from '@wimm/storage';
import type { UUID } from '@wimm/contracts';

// Das getrennte Modul vor dem Einstieg laden: nach SW-Kontrolle wird es so
// auch bei einem Neustart in den Sperrbildschirm vollständig gecacht.
const { FinanceWorkspace } = await import('@wimm/ui/workspace');
const profileStore = createBrowserProfileStore(import.meta.env.VITE_WIMM_NATIVE_SMOKE === '1' ? (import.meta.env.VITE_WIMM_NATIVE_SMOKE_PROFILE ?? 'wimm/native-smoke-profile/v1') : 'wimm/desktop-profile/v1');
const activity = new ApplicationActivity();
const profileApplication = new ProfileApplication(profileStore, { next: () => crypto.randomUUID() }, activity);
const platform = createDesktopPlatformServices();

function createDesktopWorkspaceStorage(profileId: UUID): WorkspaceStorage {
  // Die Playwright-Frontendprüfung läuft absichtlich ohne Tauri-Laufzeit. Die
  // Produktanwendung verwendet dort niemals den Browserfallback.
  if ('__TAURI_INTERNALS__' in window) {
    return new DesktopStorageAdapter(profileId, createTauriStorageBridge(invoke));
  }
  return new IndexedDbStorageAdapter(profileId, `wimm-ui-desktop-frontend-test-${profileId}`);
}

const runtime = createBrowserApplicationRuntime(createDesktopWorkspaceStorage, profileApplication);

export function App() {
  return <AppShell platform={platform} application={profileApplication} runtime={runtime} title="WhereIsMyMoney für den Schreibtisch">{(context) => <FinanceWorkspace context={context} desktop />}</AppShell>;
}
