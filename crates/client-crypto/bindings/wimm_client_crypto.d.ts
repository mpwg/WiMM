// SPDX-License-Identifier: AGPL-3.0-or-later
/* tslint:disable */

export class CryptoSession {
    free(): void;
    [Symbol.dispose](): void;
    decrypt(nonce: Uint8Array, aad: Uint8Array, cipher: Uint8Array): Uint8Array;
    encrypt(aad: Uint8Array, plaintext: Uint8Array): EncryptedBytes;
    encrypt_fixed(nonce: Uint8Array, aad: Uint8Array, plain: Uint8Array): Uint8Array;
    lock(): void;
    constructor(key: Uint8Array);
}

export class EncryptedBytes {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly ciphertext: Uint8Array;
    readonly nonce: Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_cryptosession_free: (a: number, b: number) => void;
    readonly __wbg_encryptedbytes_free: (a: number, b: number) => void;
    readonly cryptosession_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly cryptosession_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly cryptosession_encrypt_fixed: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly cryptosession_lock: (a: number) => void;
    readonly cryptosession_new: (a: number, b: number) => [number, number, number];
    readonly encryptedbytes_ciphertext: (a: number) => [number, number];
    readonly encryptedbytes_nonce: (a: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
