// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { browserDomainDependencies } from './application-runtime.js';
import { type ProfileApplication, type ProfileScreen, type ApplicationActivity, type ApplicationRuntime, createLocalHousehold as applicationCreateHousehold, changeLocalProfile as applicationChangeProfile, createLocalProfile as applicationCreateProfile } from '@wimm/application';
import { isTextEditing } from './platform.js';
import type { PlatformServices } from '@wimm/contracts';

import type { UnlockedUserVault } from '@wimm/crypto';

import type { ProfileStore } from './profile-store.js';
export { createBrowserProfileStore, createMemoryProfileStore } from './profile-store.js';
export type { ProfileStore, ProfileLoadResult } from './profile-store.js';

import type { LocalProfile, LocalArea } from '@wimm/application';
export type { AreaKind, LocalArea, LocalProfile, CreatedLocalProfile, CreatedHouseholdArea } from '@wimm/application';
export interface AppShellProps {
  readonly title: string;
  readonly application: ProfileApplication;
  readonly runtime: ApplicationRuntime;
  readonly platform: PlatformServices;
  readonly children?: (context: UnlockedAppContext) => ReactNode;
}

export interface UnlockedAppContext {
  readonly profile: LocalProfile;
  readonly activeArea: LocalArea;
  readonly profileChanging: boolean;
  readonly isProfileChanging: () => boolean;
  readonly selectArea: (areaId: string) => void;
  readonly createHousehold: () => Promise<void>;
  readonly lock: () => Promise<void>;
  readonly platform: PlatformServices;
  readonly activity: ApplicationActivity;
  readonly runtime: ApplicationRuntime;
}

type Screen = ProfileScreen;

export { selectLocalArea, upgradeLocalProfileKdf } from '@wimm/application';
export const createLocalHousehold = (profile: LocalProfile, vault: UnlockedUserVault) => applicationCreateHousehold(profile, vault, browserDomainDependencies().ids);
export const changeLocalProfile = (store: ProfileStore, profile: LocalProfile, session: UnlockedUserVault, areaId?: string, isCurrent: () => boolean = () => true) => applicationChangeProfile(store, profile, session, areaId, isCurrent, browserDomainDependencies().ids);
export const createLocalProfile = (passphrase: string) => applicationCreateProfile(passphrase, browserDomainDependencies().ids);

export function AppShell({ title, application, runtime, platform, children }: AppShellProps) {
  const snapshot = useSyncExternalStore(application.subscribe, application.getSnapshot);
  const screen = snapshot.screen;
  const notice = snapshot.notice;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (closeTimer.current !== undefined) clearTimeout(closeTimer.current);
    void application.start();
    return () => { closeTimer.current = setTimeout(() => application.dispose(), 0); };
  }, [application]);
  useEffect(() => {
    if (screen.kind === 'unlocked') return;
    let disposed = false; let stop: (() => void) | undefined;
    void platform.onMenuCommand((id) => { if ((id === 'undo' || id === 'redo') && isTextEditing(document.activeElement)) document.execCommand(id); }).then((unlisten) => { if (disposed) unlisten(); else stop = unlisten; }).catch(() => application.notice('Die Systemmenüs konnten nicht verbunden werden.'));
    return () => { disposed = true; stop?.(); };
  }, [platform, screen.kind, application]);
  if (screen.kind === 'loading') return notice === undefined ? <main className="startup"><p>WhereIsMyMoney wird vorbereitet …</p></main> : <Problem title="Start nicht möglich" message={notice} />;
  if (screen.kind === 'profile-error') return <Problem title="Lokales Profil nicht verfügbar" message={screen.error.message} />;
  if (screen.kind === 'create') return <CreateVault notice={notice} title={title} screen={screen} application={application} busy={snapshot.busy} />;
  if (screen.kind === 'unlock') return <UnlockVault notice={notice} title={title} application={application} busy={snapshot.busy} />;
  const activeArea = screen.profile.areas.find((area) => area.id === screen.profile.selectedAreaId) ?? screen.profile.areas[0]!;
  const context: UnlockedAppContext = {
    profile: screen.profile, activeArea, profileChanging: snapshot.changing, isProfileChanging: application.isChanging,
    selectArea(areaId) { void application.changeArea(areaId); }, createHousehold: () => application.changeArea(), lock: () => application.lock(), platform, activity: application.activity, runtime
  };
  return <>{notice === undefined ? undefined : <p role="alert">{notice}</p>}<AppContent context={context} title={title} render={children} /></>;
}

function AppContent({ context, title, render }: { readonly context: UnlockedAppContext; readonly title: string; readonly render: AppShellProps['children'] }) {
  return render === undefined ? <LocalStart context={context} title={title} /> : <>{render(context)}</>;
}

function LocalStart({ context, title }: { readonly context: UnlockedAppContext; readonly title: string }) {
  return <main className="workspace"><p className="eyebrow">{title}</p><h1>{context.activeArea.label}</h1>
    <p>Lokaler Bereich · Tresor entsperrt · Noch nicht mit einem Server verbunden</p>
    <nav aria-label="Bereich wechseln"><span>Bereiche</span>{context.profile.areas.map((area) =>
      <button aria-pressed={area.id === context.activeArea.id} key={area.id} onClick={() => context.selectArea(area.id)} type="button">{area.label}</button>
    )}<button onClick={() => void context.createHousehold()} type="button">Haushalt anlegen</button></nav>
    <p>Die Finanzansichten werden geladen, sobald die lokale Oberfläche bereit ist.</p>
    <button onClick={() => void context.lock()} type="button">Tresor sperren</button>
  </main>;
}

function EntrySteps({ current }: { readonly current: number }) {
  return <ol className="stepper" aria-label="Lokaler Einstieg">{['Tresor anlegen', 'Rettungscode sichern', 'Erstes Konto'].map((label, index) => <li key={label} aria-current={index === current ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>;
}

function CreateVault({ notice, title, screen, application, busy }: {
  readonly notice?: string | undefined; readonly title: string; readonly screen: Extract<Screen, { kind: 'create' }>; readonly application: ProfileApplication; readonly busy: boolean;
}) {
  const [passphrase, setPassphrase] = useState(''); const [confirmation, setConfirmation] = useState(''); const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); application.clearNotice();
    if (passphrase !== confirmation) { application.notice('Die beiden Entsperrpassphrasen stimmen nicht überein.'); return; }
    await application.prepare(passphrase);
  }
  async function finish(event: FormEvent) { event.preventDefault(); await application.confirmRecovery(passphrase, recoveryConfirmed); }
  if (screen.recoveryCode !== undefined) {
    return <main className="auth"><p className="product auth-brand" aria-label={title}>Wi<span>MM.</span></p><EntrySteps current={1} /><h1>Rettungscode sichern</h1>
      <p>Dieser Code ist der zweite Weg zu Ihren Finanzschlüsseln. Er wird nicht erneut angezeigt und nie an einen Server gesendet.</p>
      <output className="recovery-code" aria-label="Rettungscode">{screen.recoveryCode}</output>
      {notice === undefined ? undefined : <p role="alert">{notice}</p>}
      <form onSubmit={(event) => { void finish(event); }}><label><input type="checkbox" checked={recoveryConfirmed} onChange={(event) => setRecoveryConfirmed(event.target.checked)} /> Ich habe den Rettungscode sicher abgelegt.</label>
        <button disabled={!recoveryConfirmed || busy} type="submit">Lokalen Bereich eröffnen</button></form>
    </main>;
  }
  return <main className="auth"><p className="product auth-brand" aria-label={title}>Wi<span>MM.</span></p><EntrySteps current={0} /><h1>Lokalen Tresor anlegen</h1>
    <p>Die App funktioniert ohne Konto und Server. Die Entsperrpassphrase bleibt auf diesem Gerät.</p>
    {notice === undefined ? undefined : <p role="alert">{notice}</p>}
    <form onSubmit={(event) => { void submit(event); }}><label>Entsperrpassphrase<input autoComplete="new-password" minLength={12} onChange={(event) => setPassphrase(event.target.value)} required type="password" value={passphrase} /></label>
      <label>Passphrase wiederholen<input autoComplete="new-password" minLength={12} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
      <button disabled={busy} type="submit">Tresor anlegen</button></form>
  </main>;
}

function UnlockVault({ notice, title, application, busy }: { readonly notice?: string | undefined; readonly title: string; readonly application: ProfileApplication; readonly busy: boolean }) {
  const [secret, setSecret] = useState(''); const [recovery, setRecovery] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); await application.unlock(secret, recovery); }
  return <main className="auth"><p className="product auth-brand" aria-label={title}>Wi<span>MM.</span></p><h1>Tresor entsperren</h1><p>Eine Serveranmeldung ist hierfür nicht erforderlich.</p>
    {notice === undefined ? undefined : <p role="alert">{notice}</p>}
    <form onSubmit={(event) => { void submit(event); }}><label>{recovery ? 'Rettungscode' : 'Entsperrpassphrase'}<input autoComplete="current-password" onChange={(event) => setSecret(event.target.value)} required type="password" value={secret} /></label>
      <label><input checked={recovery} onChange={(event) => setRecovery(event.target.checked)} type="checkbox" /> Rettungscode verwenden</label>
      <button disabled={busy} type="submit">Entsperren</button></form>
  </main>;
}

function Problem({ title, message }: { readonly title: string; readonly message: string }) {
  return <main className="auth"><h1>{title}</h1><p role="alert">{message}</p></main>;
}
