// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  addIndependentSpaceKey,
  createUserVault,
  lockUserVault,
  persistUnlockedUserVault,
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
    const tampered = { ...created.record, vault: { ...created.record.vault, ciphertext: `${created.record.vault.ciphertext.slice(0, -1)}A` } };
    await expect(unlockUserVaultWithPassphrase(tampered, passphrase)).rejects.toBeInstanceOf(VaultUnlockError);
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
