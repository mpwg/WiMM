// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserProfileStore } from '@wimm/ui';

const profileStore = createBrowserProfileStore();

export function App() {
  return <AppShell store={profileStore} title="WhereIsMyMoney" />;
}
