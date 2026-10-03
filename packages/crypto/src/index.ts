// SPDX-License-Identifier: AGPL-3.0-or-later
import canonicalize from 'canonicalize';
import sodium from 'libsodium-wrappers-sumo';

const textEncoder = new TextEncoder();

export const cryptoContexts = {
  certificate: 'wimm/v1/certificate',
  grant: 'wimm/v1/grant',
  operation: 'wimm/v1/operation',
  roster: 'wimm/v1/roster',
  snapshot: 'wimm/v1/snapshot'
} as const;

export type CryptoContext = keyof typeof cryptoContexts;

export interface XChaCha20Poly1305Ciphertext {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface XChaCha20Poly1305DecryptInput extends XChaCha20Poly1305Ciphertext {
  associatedData: Uint8Array;
  key: Uint8Array;
}

export interface XChaCha20Poly1305EncryptInput {
  associatedData: Uint8Array;
  key: Uint8Array;
  plaintext: Uint8Array;
}

export interface Ed25519KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** Initialisiert die geprüfte libsodium-WASM-Bindung vor ihrer ersten Nutzung. */
export async function initializeCrypto(): Promise<void> {
  await sodium.ready;
}

/** Liefert den festen Domain-Separator als UTF-8-Bytes für AAD oder Signaturen. */
export function cryptoContextBytes(context: CryptoContext): Uint8Array {
  return textEncoder.encode(cryptoContexts[context]);
}

/** Kanonisiert JSON gemäß RFC 8785 über die gewählte Standardbibliothek. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  const canonicalJson = canonicalize(value);

  if (canonicalJson === undefined) {
    throw new TypeError('Der Wert kann nicht als kanonisches JSON dargestellt werden.');
  }

  return textEncoder.encode(canonicalJson);
}

/** Verschlüsselt mit XChaCha20-Poly1305-IETF und erzeugt pro Aufruf eine frische Nonce. */
export async function encryptXChaCha20Poly1305(
  input: XChaCha20Poly1305EncryptInput
): Promise<XChaCha20Poly1305Ciphertext> {
  await initializeCrypto();

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    input.plaintext,
    input.associatedData,
    null,
    nonce,
    input.key
  );

  return { ciphertext, nonce };
}

/** Entschlüsselt und authentifiziert XChaCha20-Poly1305-IETF-Daten einschließlich AAD. */
export async function decryptXChaCha20Poly1305(
  input: XChaCha20Poly1305DecryptInput
): Promise<Uint8Array> {
  await initializeCrypto();

  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    input.ciphertext,
    input.associatedData,
    input.nonce,
    input.key
  );
}

/** Erzeugt ein Ed25519-Schlüsselpaar mit dem kryptografischen Zufall von libsodium. */
export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  await initializeCrypto();

  return sodium.crypto_sign_keypair();
}

/** Signiert Bytes mit Ed25519. Die aufrufende Schicht legt die vollständigen Kontextbytes fest. */
export async function signEd25519(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  await initializeCrypto();

  return sodium.crypto_sign_detached(message, privateKey);
}

/** Prüft eine Ed25519-Signatur, ohne Inhalte zu entschlüsseln oder zu interpretieren. */
export async function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  await initializeCrypto();

  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}
