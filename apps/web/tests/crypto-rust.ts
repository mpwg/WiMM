import type * as Binding from '../../../crates/client-crypto/bindings/wimm_client_crypto.js';
// SPDX-License-Identifier: AGPL-3.0-or-later
const url=new URL(window.location.href).searchParams.get('wasmUrl');
if(url===null||!url.startsWith('/@fs/')||!url.endsWith('/wimm_client_crypto.js'))throw new Error('Die Rust-WASM-Testdatei fehlt.');
const wasm=await import(/* @vite-ignore */ url) as typeof Binding;await wasm.default({module_or_path:await (await fetch(url.replace(/\.js$/,'_bg.wasm'))).arrayBuffer()});
declare global {interface Window { cryptoRustProbe:()=>unknown }}
window.cryptoRustProbe=()=>{
 const key=Uint8Array.from({length:32},(_,i)=>i),nonce=Uint8Array.from({length:24},(_,i)=>i),encoder=new TextEncoder(),aad=encoder.encode('wimm/v1/operation'),plain=encoder.encode('WIMM fixture v1');const session=new wasm.CryptoSession(key);
 const fixed=session.encrypt_fixed(nonce,aad,plain);const decrypted=session.decrypt(nonce,aad,fixed);const a=session.encrypt(aad,plain),b=session.encrypt(aad,plain);
 const changed=fixed.slice();changed[0]=changed[0]!^1;let error:unknown;try{session.decrypt(nonce,aad,changed);}catch(value){error=value;}
 session.lock();let locked:unknown;try{session.encrypt(aad,plain);}catch(value){locked=value;}
 const result={cipher:Array.from(fixed as Uint8Array),clear:new TextDecoder().decode(decrypted),freshNonces:Array.from(a.nonce as Uint8Array).join(',')!==Array.from(b.nonce as Uint8Array).join(','),error,locked,sourceKeyIntact:key[0]===0&&key[1]===1};a.free();b.free();session.free();return result;
};
