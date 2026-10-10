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
export function sign(message, secret) {
  const copy=secret.slice();try{return sodium.crypto_sign_detached(message,copy);}finally{sodium.memzero(copy);}
}
export function identity(seed) {
  const copy=seed.slice();try{const pair=sodium.crypto_sign_seed_keypair(copy);const result=new Uint8Array(96);result.set(pair.publicKey);result.set(pair.privateKey,32);sodium.memzero(pair.privateKey);return result;}finally{sodium.memzero(copy);}
}
export function encryptionPair(seed) {
  const copy=seed.slice();try{const pair=sodium.crypto_box_seed_keypair(copy);const result=new Uint8Array(64);result.set(pair.publicKey);result.set(pair.privateKey,32);sodium.memzero(pair.privateKey);return result;}finally{sodium.memzero(copy);}
}
export function sealed(message, publicKey) {return sodium.crypto_box_seal(message,publicKey);}
export function opened(cipher, publicKey, secret) {
  const copy=secret.slice();try{return sodium.crypto_box_seal_open(cipher,publicKey,copy);}finally{sodium.memzero(copy);}
}
export function pwhash(password,salt,ops,memory) {
  const copy=password.slice();try{return sodium.crypto_pwhash(32,copy,salt,ops,memory,sodium.crypto_pwhash_ALG_ARGON2ID13);}finally{sodium.memzero(copy);}
}
export function publicIdentity(secret) {
  const copy=secret.slice();let seed;let pair;
  try{seed=sodium.crypto_sign_ed25519_sk_to_seed(copy);pair=sodium.crypto_sign_seed_keypair(seed);if(!sodium.memcmp(pair.privateKey,copy))throw new Error('Ungültiges Schlüsselpaar.');return pair.publicKey;}
  finally{sodium.memzero(copy);if(seed)sodium.memzero(seed);if(pair)sodium.memzero(pair.privateKey);}
}
export function publicEncryption(secret) {const copy=secret.slice();try{return sodium.crypto_scalarmult_base(copy);}finally{sodium.memzero(copy);}}
