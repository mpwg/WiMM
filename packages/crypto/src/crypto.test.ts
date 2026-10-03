// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';

import {
  canonicalJsonBytes,
  cryptoContextBytes,
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  initializeCrypto,
  verifyEd25519
} from './index.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

const fixedVector = {
  aad: 'wimm/v1/operation',
  ciphertext: 'c98b4232b0b4e4d6473154abeb249953c99a6f07b2319f879e4e4fe809b8eb',
  key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  nonce: '000102030405060708090a0b0c0d0e0f1011121314151617',
  plaintext: 'WIMM fixture v1',
  publicKey: '03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8',
  signature: '2910c7c85ff35cdf16e16d9d6787cd999a33e20cac7ba336f3198dee292fedd35077993e21d2a82338e1bf5354fe5e77c19645da394cf42c11e1bdfd5ea9ac06',
  signatureMessage: 'WIMM fixture signature v1'
} as const;

describe('Kryptografiegrundlage', () => {
  it('initialisiert die libsodium-WASM-Bindung und liefert den dokumentierten Kontext', async () => {
    await expect(initializeCrypto()).resolves.toBeUndefined();
    expect(textDecoder.decode(cryptoContextBytes('operation'))).toBe(fixedVector.aad);
  });

  it('liefert kanonische RFC-8785-Bytes', () => {
    const bytes = canonicalJsonBytes({
      z: [3, { b: true, a: 'euro' }],
      a: -0,
      nested: { y: null, x: 1e-27 }
    });

    expect(textDecoder.decode(bytes)).toBe(
      '{"a":0,"nested":{"x":1e-27,"y":null},"z":[3,{"a":"euro","b":true}]}'
    );
  });

  it('entschlüsselt den festen synthetischen XChaCha20-Poly1305-Vektor', async () => {
    const plaintext = await decryptXChaCha20Poly1305({
      associatedData: textEncoder.encode(fixedVector.aad),
      ciphertext: bytesFromHex(fixedVector.ciphertext),
      key: bytesFromHex(fixedVector.key),
      nonce: bytesFromHex(fixedVector.nonce)
    });

    expect(textDecoder.decode(plaintext)).toBe(fixedVector.plaintext);
  });

  it('verschlüsselt den festen synthetischen XChaCha20-Poly1305-Vektor', async () => {
    await sodium.ready;
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      textEncoder.encode(fixedVector.plaintext),
      textEncoder.encode(fixedVector.aad),
      null,
      bytesFromHex(fixedVector.nonce),
      bytesFromHex(fixedVector.key)
    );

    expect(sodium.to_hex(ciphertext)).toBe(fixedVector.ciphertext);
  });

  it('verwirft manipuliertes Chiffrat und manipulierte AAD', async () => {
    const input = {
      associatedData: textEncoder.encode(fixedVector.aad),
      ciphertext: bytesFromHex(fixedVector.ciphertext),
      key: bytesFromHex(fixedVector.key),
      nonce: bytesFromHex(fixedVector.nonce)
    };
    const manipulatedCiphertext = Uint8Array.from(input.ciphertext);
    manipulatedCiphertext[0] = (manipulatedCiphertext[0] ?? 0) ^ 1;

    await expect(decryptXChaCha20Poly1305({ ...input, ciphertext: manipulatedCiphertext })).rejects.toThrow();
    await expect(
      decryptXChaCha20Poly1305({ ...input, associatedData: textEncoder.encode('wimm/v1/snapshot') })
    ).rejects.toThrow();
  });

  it('erzeugt für neue Verschlüsselungen frische Nonces und entschlüsselt sie', async () => {
    const input = {
      associatedData: cryptoContextBytes('operation'),
      key: bytesFromHex(fixedVector.key),
      plaintext: textEncoder.encode(fixedVector.plaintext)
    };
    const first = await encryptXChaCha20Poly1305(input);
    const second = await encryptXChaCha20Poly1305(input);

    expect(first.nonce).not.toEqual(second.nonce);
    await expect(decryptXChaCha20Poly1305({ ...first, associatedData: input.associatedData, key: input.key })).resolves.toEqual(
      input.plaintext
    );
  });

  it('prüft den festen synthetischen Ed25519-Vektor und erkennt Manipulation', async () => {
    const message = textEncoder.encode(fixedVector.signatureMessage);
    const signature = bytesFromHex(fixedVector.signature);
    const publicKey = bytesFromHex(fixedVector.publicKey);
    const manipulatedSignature = Uint8Array.from(signature);
    manipulatedSignature[0] = (manipulatedSignature[0] ?? 0) ^ 1;

    await expect(verifyEd25519(message, signature, publicKey)).resolves.toBe(true);
    await expect(verifyEd25519(textEncoder.encode('verändert'), signature, publicKey)).resolves.toBe(false);
    await expect(verifyEd25519(message, manipulatedSignature, publicKey)).resolves.toBe(false);
  });
});
