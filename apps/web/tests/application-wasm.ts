// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';
declare global { interface Window { applicationPreparationProbe(request: unknown): unknown } }
const url = new URLSearchParams(location.search).get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_core_bindings.js')) throw new Error('WASM-Prüfpfad fehlt.');
const wasm = await import(/* @vite-ignore */ url) as typeof Binding;
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die Anwendungs-WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
window.applicationPreparationProbe = request => {
  try { return wasm.prepare_application_v2(request as Binding.ApplicationRequestV2); }
  catch (error) {
    if (typeof error !== 'object' || error === null || !('contractVersion' in error) || error.contractVersion !== 2 || !('code' in error) || error.code !== 'INVALID_COMMAND') throw error;
    return { formError: true };
  }
};
