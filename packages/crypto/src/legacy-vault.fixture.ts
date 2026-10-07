// SPDX-License-Identifier: AGPL-3.0-or-later
import sodium from 'libsodium-wrappers-sumo';
import { initializeCrypto, encryptXChaCha20Poly1305, type EncryptedUserVault } from './index.js';

/** Synthetische Legacyhülle mit den historischen, exakt festgeschriebenen 2/64-MiB-Parametern. */
export async function legacyVaultRecord(record: EncryptedUserVault, recoveryCode: string, passphrase: string): Promise<EncryptedUserVault> {
  await initializeCrypto(); const aad = new TextEncoder().encode('wimm/v1/snapshot');
  const from = (value: string) => sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
  const to = (value: Uint8Array) => sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
  const recovery = from(recoveryCode);
  const vaultKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, from(record.recoveryWrap.ciphertext), aad, from(record.recoveryWrap.nonce), recovery);
  const salt = sodium.randombytes_buf(16);
  const derived = sodium.crypto_pwhash(32, passphrase, salt, 2, 64 * 1024 * 1024, sodium.crypto_pwhash_ALG_ARGON2ID13);
  try {
    const encrypted = await encryptXChaCha20Poly1305({ associatedData: aad, key: derived, plaintext: vaultKey });
    return { ...record, passphraseWrap: { algorithm: 'argon2id', salt: to(salt), nonce: to(encrypted.nonce), ciphertext: to(encrypted.ciphertext) } };
  } finally { sodium.memzero(recovery); sodium.memzero(vaultKey); sodium.memzero(derived); }
}
