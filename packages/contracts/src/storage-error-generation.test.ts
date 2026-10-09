// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type * as Binding from '../generated/local-v2/wasm/wimm_local_contracts.js';
function response(action: () => unknown): unknown { try { return action(); } catch(error) { return error; } }
it('bewahrt Fehlerformen in Node-WASM und Rust-abgeleitetem Schema', async () => {
  const root=resolve('test-results/contract-bindings-generation/local-wasm');
  const wasm=await import(/* @vite-ignore */ pathToFileURL(resolve(root,'wimm_local_contracts.js')).href) as typeof Binding;
  await wasm.default({module_or_path:await readFile(resolve(root,'wimm_local_contracts_bg.wasm'))});
  const ajv=new Ajv2020({strict:true}); const check=ajv.compile(JSON.parse(await readFile('packages/contracts/generated/local-v2/schema/local-storage-failure.schema.json','utf8')));
  for(const code of ['REVISION_CONFLICT','QUOTA','RESOURCE_UNAVAILABLE','WRITE_FAILED','UPDATE_REQUIRED','EPOCH_MISMATCH','CANCELLED','COMMIT_UNKNOWN','INVALID_RESPONSE','OPERATION_ID_REUSED'] as const) {
    const input={contractVersion:2,code,commitState:code==='COMMIT_UNKNOWN'?'unknown' as const:'notCommitted' as const};
    expect(check(input)).toBe(true); expect(wasm.roundtrip_storage_failure_v2(input)).toEqual(input);
  }
  for (const input of [{contractVersion:99,code:'QUOTA',commitState:'notCommitted'},{contractVersion:2,code:'SECRET',commitState:'notCommitted'},{contractVersion:2,code:'QUOTA',commitState:'notCommitted',payload:'secret'}]) {
    expect(check(input)).toBe(false); expect(response(()=>wasm.roundtrip_storage_failure_v2(input as Binding.StorageFailure))).toEqual({contractVersion:2,code:'INVALID_LOCAL_CONTRACT',detail:'Die lokale Vertragsform ist ungültig.'});
  }
  expect(response(()=>wasm.roundtrip_storage_failure_v2({contractVersion:2,code:'COMMIT_UNKNOWN',commitState:'notCommitted'}))).toEqual({contractVersion:2,code:'INVALID_LOCAL_CONTRACT',detail:'Die lokale Vertragsform ist ungültig.'});
});
