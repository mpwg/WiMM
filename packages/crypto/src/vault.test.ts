// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  addIndependentSpaceKey,
  createUserVault,
  lockUserVault,
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
});
