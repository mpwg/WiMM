// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { PlatformServices } from '@wimm/contracts';

import {
  addIndependentSpaceKey,
  createUserVault,
  initializeCrypto,
  lockUserVault,
  persistUnlockedUserVault,
  reencryptUserVault,
  unlockUserVaultWithPassphrase,
  unlockUserVaultWithRecoveryCode,
  type EncryptedUserVault,
  type UnlockedUserVault
} from '@wimm/crypto';

export type AreaKind = 'private' | 'household';

export interface LocalArea {
  readonly id: string;
  readonly kind: AreaKind;
  readonly label: string;
}

export interface LocalProfile {
  readonly profileId: string;
  readonly areas: readonly LocalArea[];
  readonly selectedAreaId: string;
  readonly vault: EncryptedUserVault;
}

export interface ProfileStore {
  load(): LocalProfile | undefined;
  save(profile: LocalProfile): void;
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
  | { readonly kind: 'create'; readonly recoveryCode?: string; readonly vault?: UnlockedUserVault }
  | { readonly kind: 'unlock'; readonly profile: LocalProfile }
  | { readonly kind: 'unlocked'; readonly profile: LocalProfile; readonly vault: UnlockedUserVault };

const initialAreaLabel = 'Privater Bereich';

export function createBrowserProfileStore(key = 'wimm/local-profile/v1'): ProfileStore {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? undefined : parseLocalProfile(raw);
      } catch {
        return undefined;
      }
    },
    save(profile) {
      window.localStorage.setItem(key, JSON.stringify(profile));
    }
  };
}

/** Browserport: Systemaktionen werden nur auf explizite Nutzeraktionen ausgeführt. */
export function createBrowserPlatformServices(): PlatformServices {
  const tokens = new Map<string, Uint8Array>();
  return { chooseImportFiles: async () => [], writeExport: async () => undefined, openExternalUrl: async (url) => { window.open(url, '_blank', 'noopener,noreferrer'); }, setMenuCommands: async () => undefined, getDataDirectory: async () => undefined, secureTokens: { read: async (key) => tokens.get(key), write: async (key, value) => { tokens.set(key, value.slice()); }, remove: async (key) => { tokens.delete(key); } } };
}

/** Test- und Plattformport ohne Browserpersistenz; niemals als Produktstandard verwenden. */
export function createMemoryProfileStore(initial?: LocalProfile): ProfileStore {
  let profile = initial;
  return {
    load: () => profile === undefined ? undefined : structuredClone(profile),
    save(next) { profile = structuredClone(next); }
  };
}

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
  const updatedProfile: LocalProfile = {
    ...profile,
    areas: [...profile.areas, { id, kind: 'household', label: `Haushalt ${profile.areas.filter((area) => area.kind === 'household').length + 1}` }],
    selectedAreaId: id,
    vault: await persistUnlockedUserVault(updatedVault, profile.vault)
  };
  return { profile: updatedProfile, vault: updatedVault };
}

/** Erzeugt den verschlüsselten lokalen Anfangszustand ohne eine Serveranmeldung. */
export async function createLocalProfile(passphrase: string): Promise<CreatedLocalProfile> {
  const created = await createUserVault(passphrase);
  const privateAreaId = crypto.randomUUID();
  const vault = await addIndependentSpaceKey(await unlockUserVaultWithPassphrase(created.record, passphrase), privateAreaId);
  return {
    recoveryCode: created.recoveryCode,
    profile: {
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

  useEffect(() => {
    void initializeCrypto().then(
      () => setScreen((current) => current.kind === 'loading'
        ? (store.load() === undefined ? { kind: 'create' } : { kind: 'unlock', profile: store.load()! })
        : current),
      () => setNotice('Die Client-Kryptografie konnte nicht vorbereitet werden.')
    );
  }, [store]);

  if (screen.kind === 'loading') return <main className="startup"><p>WhereIsMyMoney wird vorbereitet …</p></main>;
  if (notice !== undefined && screen.kind !== 'unlocked') return <Problem title="Start nicht möglich" message={notice} />;

  if (screen.kind === 'create') {
    return <CreateVault title={title} screen={screen} store={store} onScreen={setScreen} onNotice={setNotice} />;
  }
  if (screen.kind === 'unlock') {
    return <UnlockVault title={title} profile={screen.profile} onUnlocked={(vault) => setScreen({ ...screen, kind: 'unlocked', vault })} onNotice={setNotice} />;
  }

  const activeArea = screen.profile.areas.find((area) => area.id === screen.profile.selectedAreaId) ?? screen.profile.areas[0]!;
  const updateProfile = (profile: LocalProfile, vault = screen.vault) => {
    store.save(profile);
    setScreen({ kind: 'unlocked', profile, vault });
  };
  const context: UnlockedAppContext = {
    profile: screen.profile,
    activeArea,
    selectArea(areaId) {
      updateProfile(selectLocalArea(screen.profile, areaId));
    },
    async createHousehold() {
      try {
        const created = await createLocalHousehold(screen.profile, screen.vault);
        updateProfile(created.profile, created.vault);
      } catch {
        setNotice('Der Haushalt konnte nicht dauerhaft angelegt werden. Der bestehende Bereich bleibt unverändert.');
      }
    },
    async lock() {
      await lockUserVault(screen.vault);
      setScreen({ kind: 'unlock', profile: screen.profile });
    }
    , platform
  };

  return children === undefined ? <LocalStart context={context} title={title} /> : <>{children(context)}</>;
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

function CreateVault({ title, screen, store, onScreen, onNotice }: {
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
        profileId: crypto.randomUUID(),
        areas: [{ id: area.spaceId, kind: 'private', label: initialAreaLabel }],
        selectedAreaId: area.spaceId,
        vault: record
      };
      store.save(profile);
      onScreen({ kind: 'unlock', profile });
    } catch {
      onNotice('Der Tresor konnte nicht dauerhaft vorbereitet werden.');
    } finally {
      setBusy(false);
    }
  }

  if (screen.recoveryCode !== undefined) {
    return <main className="auth"><p className="eyebrow">{title}</p><h1>Rettungscode sichern</h1>
      <p>Dieser Code ist der zweite Weg zu Ihren Finanzschlüsseln. Er wird nicht erneut angezeigt und nie an einen Server gesendet.</p>
      <output className="recovery-code" aria-label="Rettungscode">{screen.recoveryCode}</output>
      <form onSubmit={finish}><label><input type="checkbox" checked={recoveryConfirmed} onChange={(event) => setRecoveryConfirmed(event.target.checked)} /> Ich habe den Rettungscode sicher abgelegt.</label>
        <button disabled={!recoveryConfirmed || busy} type="submit">Lokalen Bereich eröffnen</button></form>
    </main>;
  }
  return <main className="auth"><p className="eyebrow">{title}</p><h1>Lokalen Tresor anlegen</h1>
    <p>Die App funktioniert ohne Konto und Server. Die Entsperrpassphrase bleibt auf diesem Gerät.</p>
    <form onSubmit={submit}><label>Entsperrpassphrase<input autoComplete="new-password" minLength={12} onChange={(event) => setPassphrase(event.target.value)} required type="password" value={passphrase} /></label>
      <label>Passphrase wiederholen<input autoComplete="new-password" minLength={12} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
      <button disabled={busy} type="submit">Tresor anlegen</button></form>
  </main>;
}

function UnlockVault({ title, profile, onUnlocked, onNotice }: {
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
      onUnlocked(recovery
        ? await unlockUserVaultWithRecoveryCode(profile.vault, secret)
        : await unlockUserVaultWithPassphrase(profile.vault, secret));
    } catch {
      onNotice('Der Tresor konnte nicht entsperrt werden. Passphrase oder Rettungscode prüfen.');
    } finally { setBusy(false); }
  }
  return <main className="auth"><p className="eyebrow">{title}</p><h1>Tresor entsperren</h1><p>Eine Serveranmeldung ist hierfür nicht erforderlich.</p>
    <form onSubmit={submit}><label>{recovery ? 'Rettungscode' : 'Entsperrpassphrase'}<input autoComplete="current-password" onChange={(event) => setSecret(event.target.value)} required type="password" value={secret} /></label>
      <label><input checked={recovery} onChange={(event) => setRecovery(event.target.checked)} type="checkbox" /> Rettungscode verwenden</label>
      <button disabled={busy} type="submit">Entsperren</button></form>
  </main>;
}

function Problem({ title, message }: { readonly title: string; readonly message: string }) {
  return <main className="auth"><h1>{title}</h1><p role="alert">{message}</p></main>;
}

function parseLocalProfile(value: string): LocalProfile | undefined {
  try {
    const profile = JSON.parse(value) as LocalProfile;
    if (!profile.profileId || !profile.vault || !Array.isArray(profile.areas) || profile.areas.length === 0) return undefined;
    return profile;
  } catch { return undefined; }
}
