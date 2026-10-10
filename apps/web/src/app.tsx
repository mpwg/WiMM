// SPDX-License-Identifier: AGPL-3.0-or-later
import { createBrowserProfileStore, createBrowserApplicationRuntime,createBrowserStoragePersistence,BrowserSqliteStorageAdapter } from '@wimm/browser-adapters';
import { ProfileApplication, ApplicationActivity } from '@wimm/application';
import { AppShell, createBrowserPlatformServices } from '@wimm/ui';
import type { UUID } from '@wimm/contracts';

// Das getrennte Modul vor dem Einstieg laden: nach SW-Kontrolle wird es so
// auch bei einem Neustart in den Sperrbildschirm vollständig gecacht.
const { FinanceWorkspace } = await import('@wimm/ui/workspace');
const profileStore = createBrowserProfileStore();
const activity = new ApplicationActivity();
const profileApplication = new ProfileApplication(profileStore, { next: () => crypto.randomUUID() }, activity);
const platform = createBrowserPlatformServices();
const storageForProfile = (profileId: UUID) => new BrowserSqliteStorageAdapter(profileId);

const runtime = createBrowserApplicationRuntime(storageForProfile, profileApplication,{persistence:createBrowserStoragePersistence()});

export function App() {
  return <AppShell platform={platform} application={profileApplication} runtime={runtime} title="WhereIsMyMoney">{(context) => <FinanceWorkspace context={context} />}</AppShell>;
}
