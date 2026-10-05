// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserPlatformServices, createBrowserProfileStore } from '@wimm/ui';
import { IndexedDbStorageAdapter } from '@wimm/storage';
import type { UUID } from '@wimm/contracts';

// Das getrennte Modul vor dem Einstieg laden: nach SW-Kontrolle wird es so
// auch bei einem Neustart in den Sperrbildschirm vollständig gecacht.
const { FinanceWorkspace } = await import('@wimm/ui/workspace');
const profileStore = createBrowserProfileStore();
const platform = createBrowserPlatformServices();
const storageForProfile = (profileId: UUID) => new IndexedDbStorageAdapter(profileId, `wimm-ui-${profileId}`);

export function App() {
  return <AppShell platform={platform} store={profileStore} title="WhereIsMyMoney">{(context) => <FinanceWorkspace context={context} storageForProfile={storageForProfile} />}</AppShell>;
}
