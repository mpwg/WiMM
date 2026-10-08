// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich synthetische Binding-Testseite, kein produktiver Einstieg.
import { createJsonReferenceEngine } from '@wimm/core-bindings';
import type { CoreCommandRequest, CoreCalculationRequest } from '@wimm/contracts';
const url = new URL(window.location.href).searchParams.get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_core_bindings.js')) throw new Error('Die lokale WASM-Testdatei fehlt.');
const wasm = await import(/* @vite-ignore */ url) as { default(input: { module_or_path: ArrayBuffer }): Promise<void>; execute_json(request: string): string; calculate_json(request: string): string; roundtrip_json(request: string): string };
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die lokale WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
const engine = createJsonReferenceEngine((method, request) => method === 'execute' ? wasm.execute_json(request) : wasm.calculate_json(request));
declare global { interface Window { rustCoreProbe: (method: 'execute' | 'calculate' | 'roundtrip', request: unknown) => Promise<unknown> } }
window.rustCoreProbe = async (method, request) => {
  if (method === 'roundtrip') return JSON.parse(wasm.roundtrip_json(JSON.stringify(request))) as unknown;
  if (typeof request === 'object' && request !== null && 'contractVersion' in request && request.contractVersion !== 1) return JSON.parse(method === 'execute' ? wasm.execute_json(JSON.stringify(request)) : wasm.calculate_json(JSON.stringify(request))) as unknown;
  return method === 'execute' ? engine.execute(request as CoreCommandRequest) : engine.calculate(request as CoreCalculationRequest);
};
