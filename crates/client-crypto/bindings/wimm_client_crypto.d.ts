// SPDX-License-Identifier: AGPL-3.0-or-later
/* tslint:disable */

export class CreatedVault {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static create(password: Uint8Array): CreatedVault;
    readonly record: Uint8Array;
    readonly recoveryCode: string;
}

export class CryptoSession {
    free(): void;
    [Symbol.dispose](): void;
    decrypt(nonce: Uint8Array, aad: Uint8Array, cipher: Uint8Array): Uint8Array;
    encrypt(aad: Uint8Array, plaintext: Uint8Array): EncryptedBytes;
    encrypt_fixed(nonce: Uint8Array, aad: Uint8Array, plain: Uint8Array): Uint8Array;
    lock(): void;
    constructor(key: Uint8Array);
    open_snapshot(record: Uint8Array): Uint8Array;
    seal_snapshot(plaintext: Uint8Array): Uint8Array;
}

export class EncryptedBytes {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly ciphertext: Uint8Array;
    readonly nonce: Uint8Array;
}

export class SealedSession {
    free(): void;
    [Symbol.dispose](): void;
    static from_seed(seed: Uint8Array): SealedSession;
    lock(): void;
    constructor();
    open(cipher: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export class SigningSession {
    free(): void;
    [Symbol.dispose](): void;
    static from_seed(seed: Uint8Array): SigningSession;
    lock(): void;
    constructor();
    sign(message: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export class VaultSession {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    has_space(id: string, version: bigint): boolean;
    lock(): void;
    static unlock_passphrase(record: Uint8Array, password: Uint8Array): VaultSession;
    static unlock_recovery(record: Uint8Array, code: string): VaultSession;
    upgrade_passphrase(record: Uint8Array, password: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export function canonical_json(input: string): Uint8Array;

export function passphrase_session(password: Uint8Array, salt: Uint8Array, ops: number, memory: number, legacy: boolean): CryptoSession;

export function seal_to(message: Uint8Array, _public: Uint8Array): Uint8Array;

export function validate_key_pairs(identity_public: Uint8Array, identity_secret: Uint8Array, encryption_public: Uint8Array, encryption_secret: Uint8Array): void;

export function verify_public(message: Uint8Array, signature: Uint8Array, public_key: Uint8Array): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_createdvault_free: (a: number, b: number) => void;
    readonly __wbg_cryptosession_free: (a: number, b: number) => void;
    readonly __wbg_encryptedbytes_free: (a: number, b: number) => void;
    readonly __wbg_sealedsession_free: (a: number, b: number) => void;
    readonly __wbg_signingsession_free: (a: number, b: number) => void;
    readonly __wbg_vaultsession_free: (a: number, b: number) => void;
    readonly canonical_json: (a: number, b: number) => [number, number, number, number];
    readonly createdvault_create: (a: number, b: number) => [number, number, number];
    readonly createdvault_record: (a: number) => [number, number];
    readonly createdvault_recoveryCode: (a: number) => [number, number];
    readonly cryptosession_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly cryptosession_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly cryptosession_encrypt_fixed: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly cryptosession_lock: (a: number) => void;
    readonly cryptosession_new: (a: number, b: number) => [number, number, number];
    readonly cryptosession_open_snapshot: (a: number, b: number, c: number) => [number, number, number];
    readonly cryptosession_seal_snapshot: (a: number, b: number, c: number) => [number, number, number, number];
    readonly encryptedbytes_ciphertext: (a: number) => [number, number];
    readonly encryptedbytes_nonce: (a: number) => [number, number];
    readonly passphrase_session: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly seal_to: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly sealedsession_from_seed: (a: number, b: number) => [number, number, number];
    readonly sealedsession_lock: (a: number) => void;
    readonly sealedsession_new: () => [number, number, number];
    readonly sealedsession_open: (a: number, b: number, c: number) => [number, number, number];
    readonly sealedsession_publicKey: (a: number) => [number, number];
    readonly signingsession_from_seed: (a: number, b: number) => [number, number, number];
    readonly signingsession_lock: (a: number) => void;
    readonly signingsession_new: () => [number, number, number];
    readonly signingsession_publicKey: (a: number) => [number, number];
    readonly signingsession_sign: (a: number, b: number, c: number) => [number, number, number, number];
    readonly validate_key_pairs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly vaultsession_has_space: (a: number, b: number, c: number, d: bigint) => number;
    readonly vaultsession_lock: (a: number) => void;
    readonly vaultsession_publicKey: (a: number) => [number, number, number, number];
    readonly vaultsession_unlock_passphrase: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly vaultsession_unlock_recovery: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly vaultsession_upgrade_passphrase: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly verify_public: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
