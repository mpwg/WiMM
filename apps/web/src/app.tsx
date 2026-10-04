// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserPlatformServices, createBrowserProfileStore, FinanceWorkspace } from '@wimm/ui';
import { IndexedDbStorageAdapter } from '@wimm/storage';
import type { UUID } from '@wimm/contracts';

const profileStore = createBrowserProfileStore();
const platform = createBrowserPlatformServices();
const storageForProfile = (profileId: UUID) => new IndexedDbStorageAdapter(profileId, `wimm-ui-${profileId}`);

export function App() {
  return <AppShell platform={platform} store={profileStore} title="WhereIsMyMoney">{(context) => <FinanceWorkspace context={context} storageForProfile={storageForProfile} />}</AppShell>;
}
