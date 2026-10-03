// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserPlatformServices, createBrowserProfileStore, FinanceWorkspace } from '@wimm/ui';

const profileStore = createBrowserProfileStore();
const platform = createBrowserPlatformServices();

export function App() {
  return <AppShell platform={platform} store={profileStore} title="WhereIsMyMoney">{(context) => <FinanceWorkspace context={context} />}</AppShell>;
}
