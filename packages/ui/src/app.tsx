// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isTextEditing } from './platform.js';
import type { PlatformServices } from '@wimm/contracts';

import {
  addIndependentSpaceKey,
  createUserVault,
  initializeCrypto,
  lockUserVault,
  persistUnlockedUserVault,
  reencryptUserVault,
  refreshUnlockedUserVault,
  unlockUserVaultWithPassphrase,
  unlockUserVaultWithRecoveryCode,
  type EncryptedUserVault,
  type UnlockedUserVault
} from '@wimm/crypto';

import { ProfileConflictError, ProfileLoadError, type ProfileLoadResult, type ProfileStore } from './profile-store.js';
export { createBrowserProfileStore, createMemoryProfileStore } from './profile-store.js';
export type { ProfileStore, ProfileLoadResult } from './profile-store.js';

export type AreaKind = 'private' | 'household';

export interface LocalArea {
  readonly id: string;
  readonly kind: AreaKind;
  readonly label: string;
}

export interface LocalProfile {
  readonly profileId: string;
  readonly revision: number;
  readonly areas: readonly LocalArea[];
  readonly selectedAreaId: string;
  readonly vault: EncryptedUserVault;
}

export interface AppShellProps {
  readonly title: string;
  readonly store: ProfileStore;
  readonly platform: PlatformServices;
  readonly children?: (context: UnlockedAppContext) => ReactNode;
}

export interface UnlockedAppContext {
  readonly profile: LocalProfile;
  readonly activeArea: LocalArea;
  readonly selectArea: (areaId: string) => void;
  readonly createHousehold: () => Promise<void>;
  readonly lock: () => Promise<void>;
  readonly platform: PlatformServices;
}

export interface CreatedLocalProfile {
  readonly profile: LocalProfile;
  readonly recoveryCode: string;
}

export interface CreatedHouseholdArea {
  readonly profile: LocalProfile;
  readonly vault: UnlockedUserVault;
}

type Screen =
  | { readonly kind: 'loading' }
  | { readonly kind: 'profile-error'; readonly error: ProfileLoadError }
  | { readonly kind: 'create'; readonly recoveryCode?: string; readonly vault?: UnlockedUserVault }
  | { readonly kind: 'unlock'; readonly profile: LocalProfile }
  | { readonly kind: 'unlocked'; readonly profile: LocalProfile; readonly vault: UnlockedUserVault };

const initialAreaLabel = 'Privater Bereich';

export function selectLocalArea(profile: LocalProfile, areaId: string): LocalProfile {
  if (!profile.areas.some((area) => area.id === areaId)) throw new TypeError('Der Bereich gehört nicht zum lokalen Profil.');
  return { ...profile, selectedAreaId: areaId };
}

/** Ergänzt Bereich und Schlüssel zusammen, bevor das Profil dauerhaft ersetzt wird. */
export async function createLocalHousehold(
  profile: LocalProfile,
  vault: UnlockedUserVault
): Promise<CreatedHouseholdArea> {
  const id = crypto.randomUUID();
  const updatedVault = await addIndependentSpaceKey(vault, id);
  try {
    const updatedProfile: LocalProfile = {
      ...profile,
      areas: [...profile.areas, { id, kind: 'household', label: `Haushalt ${profile.areas.filter((area) => area.kind === 'household').length + 1}` }],
      selectedAreaId: id,
      vault: await persistUnlockedUserVault(updatedVault, profile.vault)
    };
    return { profile: updatedProfile, vault: updatedVault };
  } catch (error) {
    await lockUserVault(updatedVault);
    throw error;
  }
}

/** Veraltete Sitzungen lesen und entschlüsseln zuerst den aktuellen bestätigten Schlüsselbestand. */
export async function changeLocalProfile(
  store: ProfileStore,
  profile: LocalProfile,
  session: UnlockedUserVault,
  areaId?: string,
  isCurrent: () => boolean = () => true
): Promise<CreatedHouseholdArea> {
  let updated: UnlockedUserVault | undefined;
  try {
    const saved = await store.change(async (current) => {
      if (!isCurrent() || current === undefined || current.profileId !== profile.profileId) throw new ProfileConflictError();
      updated = await refreshUnlockedUserVault(session, current.vault);
      assertVaultAreas(current, updated);
      let next = current;
      if (areaId === undefined) {
        const created = await createLocalHousehold(current, updated);
        updated = created.vault;
        next = created.profile;
      } else next = selectLocalArea(current, areaId);
      if (!isCurrent()) throw new ProfileConflictError();
      return next;
    });
    if (!isCurrent()) throw new ProfileConflictError();
    return { profile: saved, vault: updated! };
  } catch (error) {
    if (updated !== undefined) await lockUserVault(updated);
    throw error;
  }
}

/** Erzeugt den verschlüsselten lokalen Anfangszustand ohne eine Serveranmeldung. */
export async function createLocalProfile(passphrase: string): Promise<CreatedLocalProfile> {
  const created = await createUserVault(passphrase);
  const privateAreaId = crypto.randomUUID();
  const vault = await addIndependentSpaceKey(await unlockUserVaultWithPassphrase(created.record, passphrase), privateAreaId);
  return {
    recoveryCode: created.recoveryCode,
    profile: {
      revision: 0,
      profileId: crypto.randomUUID(),
      areas: [{ id: privateAreaId, kind: 'private', label: initialAreaLabel }],
      selectedAreaId: privateAreaId,
      vault: await reencryptUserVault(vault, passphrase, created.recoveryCode)
    }
  };
}

export function AppShell({ title, store, platform, children }: AppShellProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [notice, setNotice] = useState<string>();
  const generation = useRef(0);
  const changing = useRef(false);
  const initialLoad = useRef<{ store: ProfileStore; promise: Promise<ProfileLoadResult> } | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    if (initialLoad.current?.store !== store) initialLoad.current = { store, promise: initializeCrypto().then(() => store.load()) };
    void initialLoad.current.promise.then((result) => {
      if (!disposed) setScreen(screenForProfile(result));
    }).catch(() => { if (!disposed) setNotice('Die Client-Kryptografie oder das lokale Profil konnten nicht vorbereitet werden.'); });
    return () => { disposed = true; generation.current += 1; };
  }, [store]);

  useEffect(() => {
    if (screen.kind === 'unlocked') return;
    let disposed = false; let stop: (() => void) | undefined;
    void platform.onMenuCommand((id) => { if ((id === 'undo' || id === 'redo') && isTextEditing(document.activeElement)) document.execCommand(id); }).then((unlisten) => { if (disposed) unlisten(); else stop = unlisten; }).catch(() => setNotice('Die Systemmenüs konnten nicht verbunden werden.'));
    return () => { disposed = true; stop?.(); };
  }, [platform, screen.kind]);

  const updateProfile = useCallback(async (areaId?: string) => {
    if (screen.kind !== 'unlocked') return;
    if (changing.current) return;
    changing.current = true;
    const started = generation.current;
    setNotice(undefined);
    try {
      const created = await changeLocalProfile(store, screen.profile, screen.vault, areaId, () => generation.current === started);
      await lockUserVault(screen.vault);
      if (generation.current !== started) { await lockUserVault(created.vault); return; }
      setScreen({ kind: 'unlocked', ...created });
    } catch (error) {
      if (generation.current === started) setNotice(error instanceof ProfileConflictError ? error.message : 'Die Profiländerung konnte nicht dauerhaft gespeichert werden. Der bestehende Bereich bleibt unverändert.');
    } finally { changing.current = false; }
  }, [screen, store]);

  const lockProfile = useCallback(async () => {
    if (screen.kind !== 'unlocked') return;
    generation.current += 1;
    await lockUserVault(screen.vault);
    try { setScreen(screenForProfile(await store.load())); }
    catch { setScreen({ kind: 'profile-error', error: new ProfileLoadError('unreadable') }); }
  }, [screen, store]);

  if (screen.kind === 'loading') {
    return notice === undefined
      ? <main className="startup"><p>WhereIsMyMoney wird vorbereitet …</p></main>
      : <Problem title="Start nicht möglich" message={notice} />;
  }

  if (screen.kind === 'profile-error') return <Problem title="Lokales Profil nicht verfügbar" message={screen.error.message} />;

  if (screen.kind === 'create') {
    return <CreateVault notice={notice} title={title} screen={screen} store={store} onScreen={setScreen} onNotice={setNotice} />;
  }
  if (screen.kind === 'unlock') {
    return <UnlockVault notice={notice} title={title} profile={screen.profile} onUnlocked={(vault) => setScreen({ ...screen, kind: 'unlocked', vault })} onNotice={setNotice} />;
  }

  const activeArea = screen.profile.areas.find((area) => area.id === screen.profile.selectedAreaId) ?? screen.profile.areas[0]!;
  const context: UnlockedAppContext = {
    profile: screen.profile,
    activeArea,
    selectArea(areaId) { void updateProfile(areaId); },
    async createHousehold() { await updateProfile(); },
    lock: lockProfile,
    platform
  };

  return <>{notice === undefined ? undefined : <p role="alert">{notice}</p>}<AppContent context={context} title={title} render={children} /></>;
}

function assertVaultAreas(profile: LocalProfile, vault: UnlockedUserVault) {
  const pairs = new Set<string>();
  if (vault.identityPublicKey.length !== 32 || vault.identityPrivateKey.length !== 64 || vault.encryptionPublicKey.length !== 32 || vault.encryptionPrivateKey.length !== 32) throw new ProfileLoadError('corrupt');
  for (const space of vault.spaces) {
    const pair = `${space.spaceId}:${space.keyVersion}`;
    if (!profile.areas.some((area) => area.id === space.spaceId) || !Number.isSafeInteger(space.keyVersion) || space.keyVersion < 1 || space.key.length !== 32 || pairs.has(pair)) throw new ProfileLoadError('corrupt');
    pairs.add(pair);
  }
  if (profile.areas.some((area) => !vault.spaces.some((space) => space.spaceId === area.id))) throw new ProfileLoadError('corrupt');
}

function screenForProfile(result: ProfileLoadResult): Screen {
  if (result.kind === 'missing') return { kind: 'create' };
  if (result.kind === 'loaded') return { kind: 'unlock', profile: result.profile };
  return { kind: 'profile-error', error: new ProfileLoadError(result.kind) };
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

function CreateVault({ notice, title, screen, store, onScreen, onNotice }: {
  readonly notice?: string | undefined;
  readonly title: string;
  readonly screen: Extract<Screen, { kind: 'create' }>;
  readonly store: ProfileStore;
  readonly onScreen: (screen: Screen) => void;
  readonly onNotice: (notice: string | undefined) => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    onNotice(undefined);
    if (passphrase !== confirmation) return onNotice('Die beiden Entsperrpassphrasen stimmen nicht überein.');
    try {
      setBusy(true);
      const created = await createUserVault(passphrase);
      const areaId = crypto.randomUUID();
      const vault = await addIndependentSpaceKey(await unlockUserVaultWithPassphrase(created.record, passphrase), areaId);
      onScreen({ kind: 'create', recoveryCode: created.recoveryCode, vault });
    } catch {
      onNotice('Der Tresor konnte nicht angelegt werden. Die Eingaben wurden nicht gespeichert.');
    } finally {
      setBusy(false);
    }
  }

  async function finish(event: FormEvent) {
    event.preventDefault();
    if (!recoveryConfirmed || screen.recoveryCode === undefined || screen.vault === undefined) return;
    try {
      setBusy(true);
      const area = screen.vault.spaces[0];
      if (area === undefined) throw new Error('Bereich fehlt');
      const record = await reencryptUserVault(screen.vault, passphrase, screen.recoveryCode);
      const profile: LocalProfile = {
        revision: 0,
        profileId: crypto.randomUUID(),
        areas: [{ id: area.spaceId, kind: 'private', label: initialAreaLabel }],
        selectedAreaId: area.spaceId,
        vault: record
      };
      const saved = await store.change(async (current) => {
        if (current !== undefined) throw new ProfileConflictError();
        return profile;
      });
      await lockUserVault(screen.vault);
      onScreen({ kind: 'unlock', profile: saved });
    } catch {
      onNotice('Der Tresor konnte nicht dauerhaft vorbereitet werden.');
    } finally {
      setBusy(false);
    }
  }

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

function UnlockVault({ notice, title, profile, onUnlocked, onNotice }: {
  readonly notice?: string | undefined;
  readonly title: string;
  readonly profile: LocalProfile;
  readonly onUnlocked: (vault: UnlockedUserVault) => void;
  readonly onNotice: (notice: string | undefined) => void;
}) {
  const [secret, setSecret] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    onNotice(undefined);
    try {
      setBusy(true);
      const unlocked = recovery
        ? await unlockUserVaultWithRecoveryCode(profile.vault, secret)
        : await unlockUserVaultWithPassphrase(profile.vault, secret);
      try { assertVaultAreas(profile, unlocked); }
      catch (error) { await lockUserVault(unlocked); throw error; }
      onUnlocked(unlocked);
    } catch (error) {
      onNotice(error instanceof ProfileLoadError ? error.message : 'Der Tresor konnte nicht entsperrt werden. Passphrase oder Rettungscode prüfen.');
    } finally { setBusy(false); }
  }
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
