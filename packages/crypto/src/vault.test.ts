// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  addIndependentSpaceKey,
  createUserVault,
  lockUserVault,
  persistUnlockedUserVault,
  refreshUnlockedUserVault,
  validateUserVaultKeyPairs,
  createEncryptedJsonSnapshotProtector,
  unlockUserVaultWithPassphrase,
  unlockUserVaultWithRecoveryCode,
  VaultUnlockError
} from './index.js';

const passphrase = 'Sichere lokale Passphrase 2026';

describe('lokaler UserVault', () => {
  it('entsperrt mit Passphrase und Rettungscode, ohne Klartext im Datensatz', async () => {
    const created = await createUserVault(passphrase);
    expect(JSON.stringify(created.record)).not.toContain('Sichere lokale Passphrase');
    expect(created.recoveryCode).toMatch(/^[A-Za-z0-9_-]+$/);

    const byPassphrase = await unlockUserVaultWithPassphrase(created.record, passphrase);
    const byRecovery = await unlockUserVaultWithRecoveryCode(created.record, created.recoveryCode);
    expect(byPassphrase.identityPublicKey).toEqual(byRecovery.identityPublicKey);
    await lockUserVault(byPassphrase);
  });

  it('lehnt falsche Passphrasen und manipulierte Verpackungen ab', async () => {
    const created = await createUserVault(passphrase);
    await expect(unlockUserVaultWithPassphrase(created.record, 'Falsche lokale Passphrase 2026')).rejects.toBeInstanceOf(VaultUnlockError);
    // Das erste Base64-Zeichen verändert Nutzbits; das letzte kann identisch
    // sein oder nur ungenutzte Füllbits verändern.
    const ciphertext = created.record.vault.ciphertext;
    const changedCiphertext = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
    const tampered = { ...created.record, vault: { ...created.record.vault, ciphertext: changedCiphertext } };
    expect(tampered.vault.ciphertext).not.toBe(ciphertext);
    await expect(unlockUserVaultWithPassphrase(tampered, passphrase)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('lehnt einen falschen Rettungscode ohne Änderung der verschlüsselten Tresorhülle ab', async () => {
    const created = await createUserVault(passphrase);
    const originalRecord = structuredClone(created.record);

    await expect(unlockUserVaultWithRecoveryCode(created.record, 'ungültiger-rettungscode'))
      .rejects.toBeInstanceOf(VaultUnlockError);
    expect(created.record).toEqual(originalRecord);

    const reopened = await unlockUserVaultWithRecoveryCode(created.record, created.recoveryCode);
    expect(reopened.identityPublicKey).toHaveLength(32);
    await lockUserVault(reopened);
  });

  it('entfernt beim Sperren die flüchtigen privaten Schlüssel und verlangt danach eine neue Entsperrung', async () => {
    const created = await createUserVault(passphrase);
    const vault = await unlockUserVaultWithPassphrase(created.record, passphrase);
    const withSpace = await addIndependentSpaceKey(vault, '00000000-0000-4000-8000-000000000019');
    const identityPublicKey = withSpace.identityPublicKey.slice();

    await lockUserVault(withSpace);

    expect([...withSpace.identityPrivateKey]).toEqual(Array(withSpace.identityPrivateKey.length).fill(0));
    expect([...withSpace.encryptionPrivateKey]).toEqual(Array(withSpace.encryptionPrivateKey.length).fill(0));
    expect([...withSpace.spaces[0]!.key]).toEqual(Array(withSpace.spaces[0]!.key.length).fill(0));
    await expect(persistUnlockedUserVault(withSpace, created.record)).rejects.toBeInstanceOf(VaultUnlockError);

    const reopened = await unlockUserVaultWithPassphrase(created.record, passphrase);
    expect(reopened.identityPublicKey).toEqual(identityPublicKey);
    await lockUserVault(reopened);
  });

  it('erzeugt unabhängige Bereichsschlüssel mit frischen Verpackungen', async () => {
    const first = await createUserVault(passphrase);
    const second = await createUserVault(passphrase);
    expect(first.record.passphraseWrap.salt).not.toBe(second.record.passphraseWrap.salt);
    expect(first.record.vault.nonce).not.toBe(second.record.vault.nonce);

    const vault = await unlockUserVaultWithPassphrase(first.record, passphrase);
    const withFirstSpace = await addIndependentSpaceKey(vault, '00000000-0000-4000-8000-000000000010');
    const withSecondSpace = await addIndependentSpaceKey(withFirstSpace, '00000000-0000-4000-8000-000000000011');
    expect(withSecondSpace.spaces[0]?.key).not.toEqual(withSecondSpace.spaces[1]?.key);
    await lockUserVault(withSecondSpace);
  });

  it('erhält nach einer Bereichsergänzung Passphrase und Rettungscode als Entsperrwege', async () => {
    const created = await createUserVault(passphrase);
    const vault = await unlockUserVaultWithPassphrase(created.record, passphrase);
    const updatedVault = await addIndependentSpaceKey(vault, '00000000-0000-4000-8000-000000000012');
    const updated = await persistUnlockedUserVault(updatedVault, created.record);

    expect(updated.vault.nonce).not.toBe(created.record.vault.nonce);
    expect((await unlockUserVaultWithPassphrase(updated, passphrase)).spaces.map((space) => space.spaceId))
      .toContain('00000000-0000-4000-8000-000000000012');
    expect((await unlockUserVaultWithRecoveryCode(updated, created.recoveryCode)).spaces.map((space) => space.spaceId))
      .toContain('00000000-0000-4000-8000-000000000012');
    await lockUserVault(updatedVault);
    await expect(persistUnlockedUserVault(updatedVault, updated)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('lädt bestätigte Bereichsschlüssel in eine unabhängige Sitzung und weist fremde oder gesperrte Tresore ab', async () => {
    const created = await createUserVault(passphrase);
    const original = await unlockUserVaultWithPassphrase(created.record, passphrase);
    const writer = await unlockUserVaultWithRecoveryCode(created.record, created.recoveryCode);
    const updated = await addIndependentSpaceKey(writer, '00000000-0000-4000-8000-000000000013');
    const record = await persistUnlockedUserVault(updated, created.record);
    const refreshed = await refreshUnlockedUserVault(original, record);
    expect(refreshed.spaces[0]!.key).toEqual(updated.spaces[0]!.key);
    await lockUserVault(refreshed);
    expect((await refreshUnlockedUserVault(original, record)).spaces).toHaveLength(1);
    const foreign = await createUserVault(passphrase);
    await expect(refreshUnlockedUserVault(original, foreign.record)).rejects.toBeInstanceOf(VaultUnlockError);
    await lockUserVault(original);
    await expect(refreshUnlockedUserVault(original, record)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('prüft beide mathematischen Schlüsselpaare ohne die gültigen Sitzungsschlüssel zu verändern', async () => {
    const created = await createUserVault(passphrase);
    for (const vault of [
      await unlockUserVaultWithPassphrase(created.record, passphrase),
      await unlockUserVaultWithRecoveryCode(created.record, created.recoveryCode)
    ]) {
      const before = structuredClone(vault);
      await expect(validateUserVaultKeyPairs(vault)).resolves.toBeUndefined();
      expect(vault).toEqual(before);
      await lockUserVault(vault);
    }
  });

  it.each(['identityPublicKey', 'identityPrivateKey', 'encryptionPublicKey', 'encryptionPrivateKey'] as const)('weist mathematisch inkonsistente %s trotz korrekter Länge ab', async (field) => {
    const created = await createUserVault(passphrase);
    const vault = await unlockUserVaultWithPassphrase(created.record, passphrase);
    const damaged = structuredClone(vault);
    const index = field === 'identityPrivateKey' ? 63 : 1;
    damaged[field][index] = (damaged[field][index] ?? 0) ^ 1;
    await expect(validateUserVaultKeyPairs(damaged)).rejects.toBeInstanceOf(VaultUnlockError);
    await validateUserVaultKeyPairs(vault);
    await lockUserVault(vault);
    await lockUserVault(damaged);
  });

  it('schützt Snapshots gegen Manipulation', async () => {
    const protector = createEncryptedJsonSnapshotProtector<{ amount: number }>(new Uint8Array(32).fill(7));
    const encrypted = await protector.seal({ amount: 100 });
    expect(new TextDecoder().decode(encrypted)).not.toContain('100');
    expect(await protector.unseal(encrypted)).toEqual({ amount: 100 });
    const changed = encrypted.slice();
    const position = changed.length - 2;
    changed[position] = (changed[position] ?? 0) ^ 1;
    await expect(protector.unseal(changed)).rejects.toBeInstanceOf(VaultUnlockError);
  });
});

it('speichert die vereinbarten KDFparameter in einer versionierten neuen Passphrasehülle', async () => {
  const created = await createUserVault(passphrase);
  expect(created.record.passphraseWrap).toMatchObject({ version: 2, kdf: { opslimit: 3, memlimit: 64 * 1024 * 1024 } });
});

import sodium from 'libsodium-wrappers-sumo';
import { vi } from 'vitest';
import { upgradeUserVaultPassphraseWrap, initializeCrypto } from './index.js';
import { legacyVaultRecord } from './legacy-vault.fixture.js';
it('entsperrt Legacy über beide Wege und verpackt nur die Passphrasehülle kompatibel neu', async () => {
  const created = await createUserVault(passphrase); const legacy = await legacyVaultRecord(created.record, created.recoveryCode, passphrase); const original = structuredClone(legacy);
  const session = await unlockUserVaultWithPassphrase(legacy, passphrase); const recovery = await unlockUserVaultWithRecoveryCode(legacy, created.recoveryCode);
  expect(session.identityPrivateKey).toEqual(recovery.identityPrivateKey);
  const upgraded = await upgradeUserVaultPassphraseWrap(session, legacy, passphrase);
  expect(upgraded.passphraseWrap).toMatchObject({ version: 2, kdf: { opslimit: 3, memlimit: 67108864 } });
  expect(upgraded.vault).toEqual(legacy.vault); expect(upgraded.recoveryWrap).toEqual(legacy.recoveryWrap); expect(legacy).toEqual(original);
  const newPassphrase = await unlockUserVaultWithPassphrase(upgraded, passphrase); const newRecovery = await unlockUserVaultWithRecoveryCode(upgraded, created.recoveryCode);
  expect(newPassphrase.identityPrivateKey).toEqual(session.identityPrivateKey); expect(newRecovery.identityPrivateKey).toEqual(session.identityPrivateKey);
  await Promise.all([session, recovery, newPassphrase, newRecovery].map(lockUserVault));
});
it('weist unzulässige KDFparameter vor crypto_pwhash ab', async () => {
  const created = await createUserVault(passphrase); await initializeCrypto(); const derive = vi.spyOn(sodium, 'crypto_pwhash');
  try {
    for (const kdf of [{ opslimit: 2, memlimit: 67108864 }, { opslimit: 7, memlimit: 67108864 }, { opslimit: 3, memlimit: 2 ** 40 }, { opslimit: 3.5, memlimit: 67108864 }]) {
      await expect(unlockUserVaultWithPassphrase({ ...created.record, passphraseWrap: { ...created.record.passphraseWrap, kdf } }, passphrase)).rejects.toBeInstanceOf(VaultUnlockError);
    }
    expect(derive).not.toHaveBeenCalled();
  } finally { derive.mockRestore(); }
});
it('authentifiziert erlaubte Parameteränderungen und erkennt das Entfernen des Headers', async () => {
  const created = await createUserVault(passphrase);
  const tampered = { ...created.record, passphraseWrap: { ...created.record.passphraseWrap, kdf: { opslimit: 4, memlimit: 67108864 } } };
  await expect(unlockUserVaultWithPassphrase(tampered, passphrase)).rejects.toBeInstanceOf(VaultUnlockError);
  const { version: _version, kdf: _kdf, ...stripped } = created.record.passphraseWrap;
  await expect(unlockUserVaultWithPassphrase({ ...created.record, passphraseWrap: stripped }, passphrase)).rejects.toBeInstanceOf(VaultUnlockError);
});
