// SPDX-License-Identifier: AGPL-3.0-or-later
import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';
import type {} from '../../apps/web/tests/crypto-rust.js';
test('Rust/WASM hält C-Vektor, Nonces, Authentifizierung und gesperrte Schlüssel ein',async({page})=>{
 await page.goto(`/tests/crypto-rust.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/crypto-proof/wasm/wimm_client_crypto.js')}`)}`);await page.waitForFunction(()=>window.cryptoRustProbe!==undefined);const result=await page.evaluate(()=>window.cryptoRustProbe());expect(result).toEqual({cipher:Array.from(Buffer.from('c98b4232b0b4e4d6473154abeb249953c99a6f07b2319f879e4e4fe809b8eb','hex')),clear:'WIMM fixture v1',freshNonces:true,sourceKeyIntact:true,error:{contractVersion:2,code:'CRYPTO_AUTH_FAILED'},locked:{contractVersion:2,code:'CRYPTO_LOCKED'}});
});
