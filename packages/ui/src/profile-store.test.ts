// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileStore } from './profile-store.js';
import { createBrowserProfileStore } from './profile-store.js';
import { createLocalProfile, changeLocalProfile } from './app.js';
import { unlockUserVaultWithPassphrase, unlockUserVaultWithRecoveryCode } from '@wimm/crypto';

async function loadedProfile(store: ProfileStore) {
  const result = await store.load();
  if (result.kind !== 'loaded') throw new Error('Testprofil fehlt');
  return result.profile;
}

const passphrase = 'b01-synthetischer-speicherport';
afterEach(() => vi.unstubAllGlobals());

function browser(raw: string | null) {
  let value = raw;
  vi.stubGlobal('window', { localStorage: { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } } });
  vi.stubGlobal('navigator', { locks: { request: async (_key: string, callback: () => Promise<unknown>) => callback() } });
  return { read: () => value, replace: (next: string) => { value = next; } };
}

describe('atomarer Browser-Profilport', () => {
  it('initialisiert die Revision eines Altprofils erst beim erfolgreichen Commit und erhält beide Entsperrwege', async () => {
    const created = await createLocalProfile(passphrase);
    const legacy = Object.fromEntries(Object.entries(created.profile).filter(([name]) => name !== 'revision'));
    const raw = JSON.stringify(legacy);
    const storage = browser(raw);
    const store = createBrowserProfileStore();
    const loaded = (await loadedProfile(store));
    expect(loaded.revision).toBe(0);
    expect(storage.read()).toBe(raw);
    const session = await unlockUserVaultWithPassphrase(loaded.vault, passphrase);
    const result = await changeLocalProfile(store, loaded, session);
    expect(result.profile.revision).toBe(1);
    for (const vault of [await unlockUserVaultWithPassphrase(result.profile.vault, passphrase), await unlockUserVaultWithRecoveryCode(result.profile.vault, created.recoveryCode)]) {
      expect(vault.spaces.map((space) => space.spaceId)).toEqual(result.profile.areas.map((area) => area.id));
    }
  }, 30_000);

  it('erkennt Änderungen außerhalb der Koordination am letzten CAS-Lesepunkt', async () => {
    const created = await createLocalProfile(passphrase);
    const storage = browser(JSON.stringify(created.profile));
    const external = JSON.stringify({ ...created.profile, revision: 9 });
    const store = createBrowserProfileStore();
    await expect(store.change(async (current) => { storage.replace(external); return current!; })).rejects.toThrow('inzwischen geändert');
    expect(storage.read()).toBe(external);
  }, 30_000);

  it('schreibt ohne Web Locks keinen unkoordinierten Fallback', async () => {
    const created = await createLocalProfile(passphrase);
    const original = JSON.stringify(created.profile);
    const storage = browser(original);
    vi.stubGlobal('navigator', {});
    await expect(createBrowserProfileStore().change(async () => created.profile)).rejects.toThrow('Speicherkoordination');
    expect(storage.read()).toBe(original);
  }, 30_000);
});

describe('B01/A02: vorhandene Fehlerprofile', () => {
  it('unterscheidet beschädigte Originalbytes von einem wirklich fehlenden Profil', async () => {
    const original = '{defektes synthetisches JSON';
    const storage = browser(original);
    const store = createBrowserProfileStore();
    expect(await store.load()).toEqual({ kind: 'corrupt' });
    expect(storage.read()).toBe(original);
  });
  it('unterscheidet einen Speicherlesefehler vom Erststart', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('Synthetischer Lesefehler'); } } });
    expect(await createBrowserProfileStore().load()).toEqual({ kind: 'unreadable' });
  });
});

it('B01/A02: validiert sämtliche Profil-/Hüllenfelder und sperrt Neuanlage über Fehlerstände', async () => {
  const created = await createLocalProfile(passphrase);
  const variants: unknown[] = [null, [], {},
    { ...created.profile, profileId: 'ungueltig' },
    { ...created.profile, revision: null },
    { ...created.profile, revision: -1 },
    { ...created.profile, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...created.profile, selectedAreaId: 'fremd' },
    { ...created.profile, areas: [] },
    { ...created.profile, areas: [created.profile.areas[0], created.profile.areas[0]] },
    { ...created.profile, areas: [{ ...created.profile.areas[0], kind: 'fremd' }] },
    { ...created.profile, areas: [{ ...created.profile.areas[0], label: '' }] },
    { ...created.profile, vault: { ...created.profile.vault, version: 2 } },
    { ...created.profile, vault: { ...created.profile.vault, vault: {} } },
    { ...created.profile, vault: { ...created.profile.vault, passphraseWrap: { ...created.profile.vault.passphraseWrap, salt: 'ungueltig' } } },
    { ...created.profile, vault: { ...created.profile.vault, recoveryWrap: { nonce: null, ciphertext: '' } } }
  ];
  for (const variant of variants) {
    const original = JSON.stringify(variant);
    const storage = browser(original);
    const store = createBrowserProfileStore();
    expect(await store.load()).toEqual({ kind: 'corrupt' });
    const update = vi.fn<Parameters<ProfileStore['change']>[0]>(async () => created.profile);
    await expect(store.change(update)).rejects.toThrow('Originaldatensatz');
    expect(update).not.toHaveBeenCalled();
    expect(storage.read()).toBe(original);
  }
  browser(null);
  expect(await createBrowserProfileStore().load()).toEqual({ kind: 'missing' });
}, 30_000);

it('B01/A02: ein Lesefehler führt auch im Änderungsport zu keinem Schreibversuch', async () => {
  const update = vi.fn<Parameters<ProfileStore['change']>[0]>();
  const write = vi.fn<(key: string, value: string) => void>();
  browser(null);
  vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('Synthetischer Lesefehler'); }, setItem: write } });
  await expect(createBrowserProfileStore().change(update)).rejects.toThrow('kann nicht gelesen werden');
  expect(update).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
