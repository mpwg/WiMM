// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../../packages/contracts/generated/public-v2/wasm/wimm_public_contracts.js';
const url = new URL(window.location.href).searchParams.get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_public_contracts.js')) throw new Error('Die öffentliche WASM-Testdatei fehlt.');
const wasm = await import(/* @vite-ignore */ url) as typeof Binding;
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die öffentliche WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
declare global { interface Window { publicFormProbe: (action: 'operation' | 'roster', request: unknown) => unknown } }
window.publicFormProbe = (action, request) => {
  try { return action === 'operation' ? wasm.validate_public_operation_form_v2(request as Binding.EncryptedOperation) : wasm.validate_public_roster_form_v2(request as Binding.SignedKeyRoster); }
  catch (error) { return error; }
};
