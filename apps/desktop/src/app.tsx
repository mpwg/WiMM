// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserPlatformServices, createBrowserProfileStore, FinanceWorkspace } from '@wimm/ui';

const profileStore = createBrowserProfileStore('wimm/desktop-profile/v1');
const platform = createBrowserPlatformServices();

export function App() {
  return <AppShell platform={platform} store={profileStore} title="WhereIsMyMoney für den Schreibtisch">{(context) => <FinanceWorkspace context={context} desktop />}</AppShell>;
}
