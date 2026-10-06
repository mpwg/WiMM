// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { changeLocalProfile, createLocalHousehold, createLocalProfile, createMemoryProfileStore, selectLocalArea, type LocalProfile } from './app.js';
import { lockUserVault, unlockUserVaultWithPassphrase, unlockUserVaultWithRecoveryCode } from '@wimm/crypto';

const profile = {
  profileId: '00000000-0000-4000-8000-000000000001',
  selectedAreaId: '00000000-0000-4000-8000-000000000011',
  areas: [
    { id: '00000000-0000-4000-8000-000000000011', kind: 'private', label: 'Privater Bereich' },
    { id: '00000000-0000-4000-8000-000000000012', kind: 'household', label: 'Haushalt 1' }
  ],
  vault: { version: 1, vault: {}, passphraseWrap: {}, recoveryWrap: {} }
} as unknown as LocalProfile;

describe('lokale Profilkomposition', () => {
  it('hält Bereichswechsel innerhalb desselben Profils', () => {
    const next = selectLocalArea(profile, '00000000-0000-4000-8000-000000000012');
    expect(next.selectedAreaId).toBe('00000000-0000-4000-8000-000000000012');
    expect(next.areas).toEqual(profile.areas);
  });

  it('lehnt fremde Bereiche ab und gibt keine veränderbare Profilreferenz heraus', async () => {
    expect(() => selectLocalArea(profile, '00000000-0000-4000-8000-000000000099')).toThrow('gehört nicht');
    const store = createMemoryProfileStore(profile);
    const loaded = (await store.load())!;
    ((loaded.areas as unknown) as { label: string }[])[0]!.label = 'Verändert';
    expect((await store.load())!.areas[0]!.label).toBe('Privater Bereich');
  });

  it('legt einen standalone-fähigen, verschlüsselten Bereich an und entsperrt ihn per Passphrase oder Rettungscode', async () => {
    const created = await createLocalProfile('sehr-lange-lokale-passphrase');
    expect(created.profile.areas).toHaveLength(1);
    expect(JSON.stringify(created.profile.vault)).not.toContain('sehr-lange-lokale-passphrase');
    expect((await unlockUserVaultWithPassphrase(created.profile.vault, 'sehr-lange-lokale-passphrase')).spaces[0]!.spaceId)
      .toBe(created.profile.selectedAreaId);
    expect((await unlockUserVaultWithRecoveryCode(created.profile.vault, created.recoveryCode)).spaces[0]!.spaceId)
      .toBe(created.profile.selectedAreaId);
  }, 30_000);

  it('bewahrt einen neuen Haushalt nach Sperren und lokalem Neustart verschlüsselt auf', async () => {
    const passphrase = 'noch-eine-lange-lokale-passphrase';
    const created = await createLocalProfile(passphrase);
    const unlocked = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
    const household = await createLocalHousehold(created.profile, unlocked);
    const store = createMemoryProfileStore(household.profile);
    const restarted = (await store.load())!;

    expect(restarted.areas).toHaveLength(2);
    expect(restarted.areas[1]!.kind).toBe('household');
    expect((await unlockUserVaultWithPassphrase(restarted.vault, passphrase)).spaces.map((space) => space.spaceId))
      .toContain(restarted.areas[1]!.id);
    expect((await unlockUserVaultWithRecoveryCode(restarted.vault, created.recoveryCode)).spaces.map((space) => space.spaceId))
      .toContain(restarted.areas[1]!.id);
  }, 30_000);

  it('behält bei einem Fehler vor dem Tresor-Commit das bestehende Profil unverändert', async () => {
    const passphrase = 'fehler-vor-tresor-commit-2026';
    const created = await createLocalProfile(passphrase);
    const vault = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
    const originalProfile = structuredClone(created.profile);
    await lockUserVault(vault);

    await expect(createLocalHousehold(created.profile, vault)).rejects.toThrow('Tresor');
    expect(created.profile).toEqual(originalProfile);
    expect((await unlockUserVaultWithPassphrase(created.profile.vault, passphrase)).spaces)
      .toHaveLength(1);
  }, 30_000);
  it('erhält Haushalte beider veralteter Sitzungen und ihre Recovery-Schlüssel', async () => {
    const passphrase = 'synthetische-zwei-tab-passphrase';
    const created = await createLocalProfile(passphrase);
    const store = createMemoryProfileStore(created.profile);
    const first = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
    const second = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
    await Promise.all([
      changeLocalProfile(store, created.profile, first),
      changeLocalProfile(store, created.profile, second)
    ]);
    await changeLocalProfile(store, created.profile, first, created.profile.selectedAreaId);
    const restarted = (await store.load())!;
    expect(restarted.areas).toHaveLength(3);
    expect(restarted.revision).toBe(3);
    const unlocked = await unlockUserVaultWithPassphrase(restarted.vault, passphrase);
    expect(unlocked.spaces.map((space) => space.spaceId).sort()).toEqual(restarted.areas.map((area) => area.id).sort());
    const recovered = await unlockUserVaultWithRecoveryCode(restarted.vault, created.recoveryCode);
    expect(recovered.spaces.map((space) => space.spaceId).sort()).toEqual(restarted.areas.map((area) => area.id).sort());
  }, 30_000);

  it('rollt fehlgeschlagene Speicheränderungen zurück, ohne die bestehende Sitzung zu sperren', async () => {
    const passphrase = 'synthetischer-profil-quota-fehler';
    const created = await createLocalProfile(passphrase);
    const session = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
    const store = createMemoryProfileStore(created.profile);
    const failing = { load: () => store.load(), change: async (update: Parameters<typeof store.change>[0]) => {
      await update(created.profile);
      throw new Error('Synthetischer Quota-Fehler');
    } };
    await expect(changeLocalProfile(failing, created.profile, session)).rejects.toThrow('Quota');
    expect(await store.load()).toEqual(created.profile);
    await changeLocalProfile(store, created.profile, session);
    expect((await store.load())!.areas).toHaveLength(2);
  }, 30_000);

  it('weist veraltete Revisionen ab und lässt die nächste Änderung nach Callbackfehler zu', async () => {
    const store = createMemoryProfileStore({ ...profile, revision: 1 });
    await expect(store.change(async () => ({ ...profile, revision: 0 }))).rejects.toThrow('inzwischen geändert');
    expect((await store.load())!.revision).toBe(1);
    const saved = await store.change(async (current) => selectLocalArea(current!, profile.selectedAreaId));
    expect(saved.revision).toBe(2);
  });

});
