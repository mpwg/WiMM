// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppShell, createBrowserProfileStore } from '@wimm/ui';

const profileStore = createBrowserProfileStore('wimm/desktop-profile/v1');

export function App() {
  return <AppShell store={profileStore} title="WhereIsMyMoney für den Schreibtisch" />;
}
