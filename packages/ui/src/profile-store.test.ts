// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserProfileStore, ProfileCoordinationError } from './profile-store.js';
import { createLocalProfile, changeLocalProfile } from './app.js';
import { unlockUserVaultWithPassphrase, unlockUserVaultWithRecoveryCode } from '@wimm/crypto';

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
    const loaded = (await store.load())!;
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
    const update = vi.fn<() => Promise<typeof created.profile>>(async () => created.profile);
    await expect(createBrowserProfileStore().change(update)).rejects.toBeInstanceOf(ProfileCoordinationError);
    expect(update).not.toHaveBeenCalled();
    expect(storage.read()).toBe(original);
  }, 30_000);
});
