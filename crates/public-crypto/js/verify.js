// SPDX-License-Identifier: AGPL-3.0-or-later
import sodium from 'libsodium-wrappers-sumo';
await sodium.ready;
export function verify(message,signature,publicKey){try{return sodium.crypto_sign_verify_detached(signature,message,publicKey);}catch{return false;}}
