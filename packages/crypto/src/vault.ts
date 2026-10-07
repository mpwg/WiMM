// SPDX-License-Identifier: AGPL-3.0-or-later
import sodium from 'libsodium-wrappers-sumo';

import { decryptXChaCha20Poly1305, encryptXChaCha20Poly1305, initializeCrypto } from './index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const vaultVersion = 1 as const;
const vaultAad = encoder.encode('wimm/v1/snapshot');
/** Schlüssel bleiben ausschließlich für die Lebensdauer des entsperrten Objekts im Speicher. */
interface UnlockedVaultKeyState {
  readonly key: Uint8Array;
  locked: boolean;
}
const unlockedVaultKeys = new WeakMap<UnlockedUserVault, UnlockedVaultKeyState>();

export interface VaultSpaceKey {
  readonly spaceId: string;
  readonly keyVersion: number;
  readonly key: Uint8Array;
}

export interface UnlockedUserVault {
  readonly identityPublicKey: Uint8Array;
  readonly identityPrivateKey: Uint8Array;
  readonly encryptionPublicKey: Uint8Array;
  readonly encryptionPrivateKey: Uint8Array;
  readonly spaces: readonly VaultSpaceKey[];
}

export interface EncryptedVaultEnvelope {
  readonly version: typeof vaultVersion;
  readonly ciphertext: string;
  readonly nonce: string;
}

export interface PassphraseWrap {
  readonly algorithm: 'argon2id';
  /** Fehlende Version und Parameter kennzeichnen ausschließlich Legacy 2/64 MiB. */
  readonly version?: 2;
  readonly kdf?: { readonly opslimit: number; readonly memlimit: number };
  readonly salt: string;
  readonly nonce: string;
  readonly ciphertext: string;
}

export interface RecoveryWrap {
  readonly nonce: string;
  readonly ciphertext: string;
}

/** Dieser persistierbare Datensatz enthält niemals V oder private Schlüssel im Klartext. */
export interface EncryptedUserVault {
  readonly version: typeof vaultVersion;
  readonly vault: EncryptedVaultEnvelope;
  readonly passphraseWrap: PassphraseWrap;
  readonly recoveryWrap: RecoveryWrap;
}

export interface CreatedUserVault {
  readonly record: EncryptedUserVault;
  /** Nur zur einmaligen, bestätigten Sicherung anzeigen; nicht persistieren oder protokollieren. */
  readonly recoveryCode: string;
}

export class VaultUnlockError extends Error {
  constructor() {
    super('Der Tresor konnte nicht entsperrt werden.');
    this.name = 'VaultUnlockError';
  }
}

/** Generischer Clientport für verschlüsselte Snapshots; die Speicherschicht kennt keine Kryptobibliothek. */
export function createEncryptedJsonSnapshotProtector<T>(key: Uint8Array): {
  seal(value: T): Promise<Uint8Array>;
  unseal(bytes: Uint8Array): Promise<T>;
} {
  if (key.length !== 32) throw new TypeError('Der Snapshotschlüssel muss 32 Byte lang sein.');
  return {
    async seal(value) {
      const encrypted = await encryptXChaCha20Poly1305({
        associatedData: vaultAad,
        key,
        plaintext: encoder.encode(JSON.stringify(value))
      });
      return encoder.encode(JSON.stringify({
        version: vaultVersion,
        nonce: toBase64Url(encrypted.nonce),
        ciphertext: toBase64Url(encrypted.ciphertext)
      }));
    },
    async unseal(bytes) {
      try {
        const envelope = JSON.parse(decoder.decode(bytes)) as EncryptedVaultEnvelope;
        const plaintext = await decryptXChaCha20Poly1305({
          associatedData: vaultAad,
          key,
          nonce: fromBase64Url(envelope.nonce),
          ciphertext: fromBase64Url(envelope.ciphertext)
        });
        return JSON.parse(decoder.decode(plaintext)) as T;
      } catch {
        throw new VaultUnlockError();
      }
    }
  };
}

export async function createUserVault(passphrase: string): Promise<CreatedUserVault> {
  assertPassphrase(passphrase);
  await initializeCrypto();
  const vaultKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  const recoveryKey = sodium.randombytes_buf(32);
  try {
    const identity = sodium.crypto_sign_keypair();
    const encryption = sodium.crypto_box_keypair();
    const vault: UnlockedUserVault = {
      identityPublicKey: identity.publicKey,
      identityPrivateKey: identity.privateKey,
      encryptionPublicKey: encryption.publicKey,
      encryptionPrivateKey: encryption.privateKey,
      spaces: []
    };
    return {
      record: {
        version: vaultVersion,
        vault: await encryptVault(vault, vaultKey),
        passphraseWrap: await wrapWithPassphrase(vaultKey, passphrase),
        recoveryWrap: await wrapWithRecoveryKey(vaultKey, recoveryKey)
      },
      recoveryCode: toBase64Url(recoveryKey)
    };
  } finally {
    sodium.memzero(vaultKey);
    sodium.memzero(recoveryKey);
  }
}

export async function unlockUserVaultWithPassphrase(
  record: EncryptedUserVault,
  passphrase: string
): Promise<UnlockedUserVault> {
  assertPassphrase(passphrase);
  let derivedKey: Uint8Array | undefined;
  let vaultKey: Uint8Array | undefined;
  try {
    await initializeCrypto();
    assertRecordVersion(record);
    derivedKey = derivePassphraseKey(passphrase, fromBase64Url(record.passphraseWrap.salt), passphraseParameters(record.passphraseWrap));
    vaultKey = await unwrapVaultKey(record.passphraseWrap, derivedKey, passphraseAad(record.passphraseWrap));
    const vault = await decryptVault(record.vault, vaultKey);
    unlockedVaultKeys.set(vault, { key: vaultKey, locked: false });
    vaultKey = undefined;
    return vault;
  } catch {
    throw new VaultUnlockError();
  } finally {
    if (derivedKey !== undefined) sodium.memzero(derivedKey);
    if (vaultKey !== undefined) sodium.memzero(vaultKey);
  }
}

export async function unlockUserVaultWithRecoveryCode(
  record: EncryptedUserVault,
  recoveryCode: string
): Promise<UnlockedUserVault> {
  let recoveryKey: Uint8Array | undefined;
  let vaultKey: Uint8Array | undefined;
  try {
    await initializeCrypto();
    assertRecordVersion(record);
    recoveryKey = fromBase64Url(recoveryCode);
    if (recoveryKey.length !== 32) throw new VaultUnlockError();
    vaultKey = await unwrapVaultKey(record.recoveryWrap, recoveryKey);
    const vault = await decryptVault(record.vault, vaultKey);
    unlockedVaultKeys.set(vault, { key: vaultKey, locked: false });
    vaultKey = undefined;
    return vault;
  } catch {
    throw new VaultUnlockError();
  } finally {
    if (recoveryKey !== undefined) sodium.memzero(recoveryKey);
    if (vaultKey !== undefined) sodium.memzero(vaultKey);
  }
}

/** Prüft die mathematische Zugehörigkeit der Identitäts- und Verschlüsselungsschlüssel. */
export async function validateUserVaultKeyPairs(vault: UnlockedUserVault): Promise<void> {
  await initializeCrypto();
  if (vault.identityPublicKey.length !== sodium.crypto_sign_PUBLICKEYBYTES
    || vault.identityPrivateKey.length !== sodium.crypto_sign_SECRETKEYBYTES
    || vault.encryptionPublicKey.length !== sodium.crypto_scalarmult_BYTES
    || vault.encryptionPrivateKey.length !== sodium.crypto_scalarmult_SCALARBYTES) throw new VaultUnlockError();
  // sk_to_pk würde nur den eingebetteten öffentlichen Anteil extrahieren.
  // Aus dem Seed neu ableiten und auch den vollständigen 64-Byte-Sk prüfen.
  const seed = sodium.crypto_sign_ed25519_sk_to_seed(vault.identityPrivateKey);
  let identity: { publicKey: Uint8Array; privateKey: Uint8Array } | undefined;
  try {
    identity = sodium.crypto_sign_seed_keypair(seed);
    const encryptionPublicKey = sodium.crypto_scalarmult_base(vault.encryptionPrivateKey);
    if (!sodium.memcmp(identity.publicKey, vault.identityPublicKey)
      || !sodium.memcmp(identity.privateKey, vault.identityPrivateKey)
      || !sodium.memcmp(encryptionPublicKey, vault.encryptionPublicKey)) throw new VaultUnlockError();
  } finally {
    sodium.memzero(seed);
    if (identity !== undefined) sodium.memzero(identity.privateKey);
  }
}

export async function addIndependentSpaceKey(
  vault: UnlockedUserVault,
  spaceId: string,
  keyVersion = 1
): Promise<UnlockedUserVault> {
  await initializeCrypto();
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) throw new TypeError('Die Schlüsselversion ist ungültig.');
  if (vault.spaces.some((space) => space.spaceId === spaceId && space.keyVersion === keyVersion)) {
    throw new TypeError('Der Bereichsschlüssel ist bereits vorhanden.');
  }
  const updatedVault = {
    ...vault,
    spaces: [...vault.spaces, { spaceId, keyVersion, key: sodium.randombytes_buf(32) }]
  };
  const vaultKey = unlockedVaultKeys.get(vault);
  if (vaultKey !== undefined) unlockedVaultKeys.set(updatedVault, vaultKey);
  return updatedVault;
}

export async function reencryptUserVault(
  vault: UnlockedUserVault,
  passphrase: string,
  recoveryCode: string
): Promise<EncryptedUserVault> {
  assertPassphrase(passphrase);
  await initializeCrypto();
  const vaultKey = sodium.randombytes_buf(32);
  let recoveryKey: Uint8Array | undefined;
  try {
    recoveryKey = fromBase64Url(recoveryCode);
    if (recoveryKey.length !== 32) throw new VaultUnlockError();
    return {
      version: vaultVersion,
      vault: await encryptVault(vault, vaultKey),
      passphraseWrap: await wrapWithPassphrase(vaultKey, passphrase),
      recoveryWrap: await wrapWithRecoveryKey(vaultKey, recoveryKey)
    };
  } finally {
    sodium.memzero(vaultKey);
    if (recoveryKey !== undefined) sodium.memzero(recoveryKey);
  }
}

/**
 * Schreibt einen bereits entsperrten Tresor mit seinem weiterhin nur flüchtig
 * gehaltenen Tresorschlüssel zurück. Die Passphrase- und Rettungscodehüllen
 * bleiben dabei unverändert; nur die authentifizierte Tresorhülle erhält eine
 * frische Nonce. Dies ist für lokale Änderungen wie einen neuen Bereich nötig.
 */
export async function persistUnlockedUserVault(
  vault: UnlockedUserVault,
  record: EncryptedUserVault
): Promise<EncryptedUserVault> {
  await initializeCrypto();
  assertRecordVersion(record);
  const vaultKey = unlockedVaultKeys.get(vault);
  if (vaultKey === undefined || vaultKey.locked) throw new VaultUnlockError();
  return { ...record, vault: await encryptVault(vault, vaultKey.key) };
}

/** Lädt den aktuellen bestätigten Tresor mit einer bestehenden Sitzung, ohne Schlüsselbestände zu verschmelzen. */
export async function refreshUnlockedUserVault(
  session: UnlockedUserVault,
  record: EncryptedUserVault
): Promise<UnlockedUserVault> {
  await initializeCrypto();
  assertRecordVersion(record);
  const state = unlockedVaultKeys.get(session);
  if (state === undefined || state.locked) throw new VaultUnlockError();
  const key = new Uint8Array(state.key);
  try {
    const vault = await decryptVault(record.vault, key);
    if (state.locked) { await lockUserVault(vault); throw new VaultUnlockError(); }
    unlockedVaultKeys.set(vault, { key, locked: false });
    return vault;
  } catch {
    sodium.memzero(key);
    throw new VaultUnlockError();
  }
}

/** Löscht geladene Schlüssel so weit JavaScript/WASM dies zulässt. */
export async function lockUserVault(vault: UnlockedUserVault): Promise<void> {
  await initializeCrypto();
  sodium.memzero(vault.identityPrivateKey);
  sodium.memzero(vault.encryptionPrivateKey);
  for (const space of vault.spaces) sodium.memzero(space.key);
  const vaultKey = unlockedVaultKeys.get(vault);
  if (vaultKey !== undefined && !vaultKey.locked) {
    sodium.memzero(vaultKey.key);
    vaultKey.locked = true;
    unlockedVaultKeys.delete(vault);
  }
}

async function encryptVault(vault: UnlockedUserVault, vaultKey: Uint8Array): Promise<EncryptedVaultEnvelope> {
  const encrypted = await encryptXChaCha20Poly1305({
    associatedData: vaultAad,
    key: vaultKey,
    plaintext: encoder.encode(JSON.stringify(serializeVault(vault)))
  });
  return { version: vaultVersion, ciphertext: toBase64Url(encrypted.ciphertext), nonce: toBase64Url(encrypted.nonce) };
}

async function decryptVault(envelope: EncryptedVaultEnvelope, vaultKey: Uint8Array): Promise<UnlockedUserVault> {
  if (envelope.version !== vaultVersion) throw new VaultUnlockError();
  const plaintext = await decryptXChaCha20Poly1305({
    associatedData: vaultAad,
    key: vaultKey,
    ciphertext: fromBase64Url(envelope.ciphertext),
    nonce: fromBase64Url(envelope.nonce)
  });
  return deserializeVault(JSON.parse(decoder.decode(plaintext)));
}

async function wrapWithPassphrase(vaultKey: Uint8Array, passphrase: string): Promise<PassphraseWrap> {
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const header = { algorithm: 'argon2id' as const, version: 2 as const, salt: toBase64Url(salt), kdf: { opslimit: 3, memlimit: 64 * 1024 * 1024 } };
  const derivedKey = derivePassphraseKey(passphrase, salt, header.kdf);
  try {
    const encrypted = await encryptXChaCha20Poly1305({ associatedData: passphraseAad(header), key: derivedKey, plaintext: vaultKey });
    return { ...header, nonce: toBase64Url(encrypted.nonce), ciphertext: toBase64Url(encrypted.ciphertext) };
  } finally { sodium.memzero(derivedKey); }
}

/** Öffentliche Parameterprüfung ohne KDFausführung, auch im Profil-Leseport. */
export function validatePassphraseKdfParameters(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const wrap = value as Record<string, unknown>;
  if (wrap.algorithm !== 'argon2id') return false;
  if (wrap.version === undefined) return wrap.kdf === undefined;
  if (wrap.version !== 2 || wrap.kdf === null || typeof wrap.kdf !== 'object') return false;
  const kdf = wrap.kdf as Record<string, unknown>;
  return typeof kdf.opslimit === 'number' && Number.isSafeInteger(kdf.opslimit) && kdf.opslimit >= 3 && kdf.opslimit <= 6
    && typeof kdf.memlimit === 'number' && Number.isSafeInteger(kdf.memlimit) && kdf.memlimit >= 64 * 1024 * 1024 && kdf.memlimit <= 256 * 1024 * 1024;
}
function passphraseParameters(wrap: PassphraseWrap) {
  if (!validatePassphraseKdfParameters(wrap)) throw new VaultUnlockError();
  return wrap.version === undefined ? { opslimit: 2, memlimit: 64 * 1024 * 1024 } : wrap.kdf!;
}
function passphraseAad(wrap: Pick<PassphraseWrap, 'version' | 'algorithm' | 'kdf' | 'salt'>): Uint8Array {
  return wrap.version === undefined ? vaultAad : encoder.encode(JSON.stringify(['wimm/v1/passphrase-wrap', wrap.version, wrap.algorithm, wrap.kdf!.opslimit, wrap.kdf!.memlimit, wrap.salt]));
}
function derivePassphraseKey(passphrase: string, salt: Uint8Array, parameters: { opslimit: number; memlimit: number }): Uint8Array {
  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) throw new VaultUnlockError();
  return sodium.crypto_pwhash(32, passphrase, salt, parameters.opslimit, parameters.memlimit, sodium.crypto_pwhash_ALG_ARGON2ID13);
}

/** Nur nach erfolgreicher Entsperrung neu verpacken; persistiert niemals selbst. */
export async function upgradeUserVaultPassphraseWrap(vault: UnlockedUserVault, record: EncryptedUserVault, passphrase: string): Promise<EncryptedUserVault> {
  assertPassphrase(passphrase); await initializeCrypto(); assertRecordVersion(record);
  const state = unlockedVaultKeys.get(vault);
  if (state === undefined || state.locked) throw new VaultUnlockError();
  let derived: Uint8Array | undefined; let confirmed: Uint8Array | undefined;
  try {
    derived = derivePassphraseKey(passphrase, fromBase64Url(record.passphraseWrap.salt), passphraseParameters(record.passphraseWrap));
    confirmed = await unwrapVaultKey(record.passphraseWrap, derived, passphraseAad(record.passphraseWrap));
    if (!sodium.memcmp(confirmed, state.key) || state.locked) throw new VaultUnlockError();
    const passphraseWrap = await wrapWithPassphrase(state.key, passphrase);
    if (state.locked) throw new VaultUnlockError();
    return { ...record, passphraseWrap };
  } finally { if (derived !== undefined) sodium.memzero(derived); if (confirmed !== undefined) sodium.memzero(confirmed); }
}

async function wrapWithRecoveryKey(vaultKey: Uint8Array, recoveryKey: Uint8Array): Promise<RecoveryWrap> {
  const encrypted = await encryptXChaCha20Poly1305({ associatedData: vaultAad, key: recoveryKey, plaintext: vaultKey });
  return { nonce: toBase64Url(encrypted.nonce), ciphertext: toBase64Url(encrypted.ciphertext) };
}

async function unwrapVaultKey(wrap: { readonly nonce: string; readonly ciphertext: string }, key: Uint8Array, associatedData: Uint8Array = vaultAad): Promise<Uint8Array> {
  return decryptXChaCha20Poly1305({ associatedData, key, ciphertext: fromBase64Url(wrap.ciphertext), nonce: fromBase64Url(wrap.nonce) });
}

function serializeVault(vault: UnlockedUserVault): Record<string, unknown> {
  return {
    identityPublicKey: toBase64Url(vault.identityPublicKey), identityPrivateKey: toBase64Url(vault.identityPrivateKey),
    encryptionPublicKey: toBase64Url(vault.encryptionPublicKey), encryptionPrivateKey: toBase64Url(vault.encryptionPrivateKey),
    spaces: vault.spaces.map((space) => ({ ...space, key: toBase64Url(space.key) }))
  };
}

function deserializeVault(value: unknown): UnlockedUserVault {
  if (typeof value !== 'object' || value === null) throw new VaultUnlockError();
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.spaces)) throw new VaultUnlockError();
  return {
    identityPublicKey: readBytes(record.identityPublicKey), identityPrivateKey: readBytes(record.identityPrivateKey),
    encryptionPublicKey: readBytes(record.encryptionPublicKey), encryptionPrivateKey: readBytes(record.encryptionPrivateKey),
    spaces: record.spaces.map((entry) => {
      if (typeof entry !== 'object' || entry === null) throw new VaultUnlockError();
      const space = entry as Record<string, unknown>;
      const keyVersion = space.keyVersion;
      if (typeof space.spaceId !== 'string' || typeof keyVersion !== 'number' || !Number.isSafeInteger(keyVersion)) {
        throw new VaultUnlockError();
      }
      return { spaceId: space.spaceId, keyVersion, key: readBytes(space.key) };
    })
  };
}

function readBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string') throw new VaultUnlockError();
  return fromBase64Url(value);
}

function assertPassphrase(passphrase: string): void {
  if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 1024) {
    throw new TypeError('Die Entsperrpassphrase muss zwischen 12 und 1024 Zeichen lang sein.');
  }
}

function assertRecordVersion(record: EncryptedUserVault): void {
  if (record.version !== vaultVersion || record.vault.version !== vaultVersion || !validatePassphraseKdfParameters(record.passphraseWrap)) {
    throw new VaultUnlockError();
  }
}

function toBase64Url(value: Uint8Array): string {
  return sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function fromBase64Url(value: string): Uint8Array {
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}
