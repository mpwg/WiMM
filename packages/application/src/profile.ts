// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IdSourcePort } from '@wimm/contracts';
import { addIndependentSpaceKey, createUserVault, lockUserVault, persistUnlockedUserVault, reencryptUserVault, refreshUnlockedUserVault, validateUserVaultKeyPairs, upgradeUserVaultPassphraseWrap, unlockUserVaultWithPassphrase, type EncryptedUserVault, type UnlockedUserVault } from '@wimm/crypto';
import { ProfileConflictError, ProfileLoadError, type ProfileStore } from './profile-store.js';
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

export interface CreatedLocalProfile {
  readonly profile: LocalProfile;
  readonly recoveryCode: string;
}

export interface CreatedHouseholdArea {
  readonly profile: LocalProfile;
  readonly vault: UnlockedUserVault;
}

export const initialAreaLabel = 'Privater Bereich';

export function selectLocalArea(profile: LocalProfile, areaId: string): LocalProfile {
  if (!profile.areas.some((area) => area.id === areaId)) throw new TypeError('Der Bereich gehört nicht zum lokalen Profil.');
  return { ...profile, selectedAreaId: areaId };
}

/** Ergänzt Bereich und Schlüssel zusammen, bevor das Profil dauerhaft ersetzt wird. */
export async function createLocalHousehold(
  profile: LocalProfile,
  vault: UnlockedUserVault,
  ids: IdSourcePort
): Promise<CreatedHouseholdArea> {
  const id = ids.next();
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
  areaId: string | undefined,
  isCurrent: () => boolean = () => true,
  ids: IdSourcePort
): Promise<CreatedHouseholdArea> {
  let updated: UnlockedUserVault | undefined;
  try {
    const saved = await store.change(async (current) => {
      if (!isCurrent() || current === undefined || current.profileId !== profile.profileId) throw new ProfileConflictError();
      updated = await refreshUnlockedUserVault(session, current.vault);
      await assertVaultAreas(current, updated);
      let next = current;
      if (areaId === undefined) {
        const created = await createLocalHousehold(current, updated, ids);
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
export async function createLocalProfile(passphrase: string, ids: IdSourcePort): Promise<CreatedLocalProfile> {
  const created = await createUserVault(passphrase);
  const privateAreaId = ids.next();
  const vault = await addIndependentSpaceKey(await unlockUserVaultWithPassphrase(created.record, passphrase), privateAreaId);
  return {
    recoveryCode: created.recoveryCode,
    profile: {
      revision: 0,
      profileId: ids.next(),
      areas: [{ id: privateAreaId, kind: 'private', label: initialAreaLabel }],
      selectedAreaId: privateAreaId,
      vault: await reencryptUserVault(vault, passphrase, created.recoveryCode)
    }
  };
}

export async function assertVaultAreas(profile: LocalProfile, vault: UnlockedUserVault) {
  const pairs = new Set<string>();
  try { await validateUserVaultKeyPairs(vault); }
  catch { throw new ProfileLoadError('corrupt'); }
  for (const space of vault.spaces) {
    const pair = `${space.spaceId}:${space.keyVersion}`;
    if (!profile.areas.some((area) => area.id === space.spaceId) || !Number.isSafeInteger(space.keyVersion) || space.keyVersion < 1 || space.key.length !== 32 || pairs.has(pair)) throw new ProfileLoadError('corrupt');
    pairs.add(pair);
  }
  if (profile.areas.some((area) => !vault.spaces.some((space) => space.spaceId === area.id))) throw new ProfileLoadError('corrupt');
}

/** Die Legacyhärtung ersetzt unter Profil-CAS ausschließlich die Passphrasehülle. */
export async function upgradeLocalProfileKdf(store: ProfileStore, profile: LocalProfile, vault: UnlockedUserVault, passphrase: string, isActive = () => true): Promise<LocalProfile> {
  return store.change(async current => {
    if (!isActive() || current === undefined || current.profileId !== profile.profileId || current.revision !== profile.revision || JSON.stringify(current.vault) !== JSON.stringify(profile.vault)) throw new ProfileConflictError();
    const upgraded = await upgradeUserVaultPassphraseWrap(vault, current.vault, passphrase);
    if (!isActive()) throw new ProfileConflictError();
    return { ...current, vault: upgraded };
  });
}
