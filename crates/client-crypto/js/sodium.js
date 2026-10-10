// SPDX-License-Identifier: AGPL-3.0-or-later
import sodium from 'libsodium-wrappers-sumo';
let initialized = false;
await sodium.ready;
initialized = true;
export const ready = () => initialized;
export function encrypt(key, nonce, aad, plaintext) {
  const temporaryKey = key.slice();
  try { return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, temporaryKey); }
  finally { sodium.memzero(temporaryKey); }
}
export function decrypt(key, nonce, aad, ciphertext) {
  const temporaryKey = key.slice();
  try { return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, temporaryKey); }
  finally { sodium.memzero(temporaryKey); }
}

export const clear = bytes => sodium.memzero(bytes);
export const random = size => sodium.randombytes_buf(size);
