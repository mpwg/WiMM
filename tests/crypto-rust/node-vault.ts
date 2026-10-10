import{primitiveInterop}from'./primitives.js';
// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFile}from'node:fs/promises';import{resolve}from'node:path';import{pathToFileURL}from'node:url';import assert from'node:assert/strict';
import type * as Binding from '../../crates/client-crypto/bindings/wimm_client_crypto.js';import{vaultInterop}from'./vault-interop.js';
const wasm=await import(pathToFileURL(resolve('test-results/crypto-proof/wasm/wimm_client_crypto.js')).href) as typeof Binding;await wasm.default({module_or_path:await readFile('test-results/crypto-proof/wasm/wimm_client_crypto_bg.wasm')});const fixture=JSON.parse(await readFile('crates/client-crypto/tests/fixtures/vault-interop.json','utf8')) as Parameters<typeof vaultInterop>[1];assert.deepEqual(await vaultInterop(wasm,fixture),{passed:16});console.log('Rust/WASM-Node↔TS: 16 tatsächliche Legacy-/Recovery-/Exportfälle bestanden.');

assert.deepEqual(await primitiveInterop(wasm),{passed:17});console.log('Rust/WASM-Node: 17 tatsächliche Signatur-/Box-/KDF-/JCS-Fälle bestanden.');
