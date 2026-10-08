// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich synthetische Binding-Testseite, kein produktiver Einstieg.
import { createJsonReferenceEngine } from '@wimm/core-bindings';
import type { CoreCommandRequest, CoreCalculationRequest } from '@wimm/contracts';
const url = new URL(window.location.href).searchParams.get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_core_bindings.js')) throw new Error('Die lokale WASM-Testdatei fehlt.');
const wasm = await import(/* @vite-ignore */ url) as { default(input: { module_or_path: ArrayBuffer }): Promise<void>; execute_json(request: string): string; calculate_json(request: string): string; roundtrip_json(request: string): string; primitive_json(request: string): string; validate_json(request: string): string; project_json(request: string): string; reverse_json(request: string): string; cache_json(request: string): string };
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die lokale WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
const engine = createJsonReferenceEngine((method, request) => method === 'execute' ? wasm.execute_json(request) : wasm.calculate_json(request));
declare global { interface Window { rustCoreProbe: (method: 'execute' | 'calculate' | 'roundtrip' | 'primitive' | 'validate' | 'project' | 'reverse' | 'cache', request: unknown) => Promise<unknown> } }
window.rustCoreProbe = async (method, request) => {
  if (typeof request === 'string') { const name = { cache:'cache_json',reverse:'reverse_json',execute:'execute_json',calculate:'calculate_json',roundtrip:'roundtrip_json',primitive:'primitive_json',validate:'validate_json',project:'project_json' }[method] as keyof typeof wasm; return JSON.parse((wasm[name] as (request:string)=>string)(request)) as unknown; }
  if (method === 'validate' || method === 'project' || method === 'reverse' || method === 'cache') return JSON.parse(wasm[`${method}_json`](JSON.stringify(request))) as unknown;
  if (method === 'primitive') return JSON.parse(wasm.primitive_json(JSON.stringify(request))) as unknown;
  if (method === 'roundtrip') return JSON.parse(wasm.roundtrip_json(JSON.stringify(request))) as unknown;
  if (typeof request === 'object' && request !== null && 'contractVersion' in request && request.contractVersion !== 1) return JSON.parse(method === 'execute' ? wasm.execute_json(JSON.stringify(request)) : wasm.calculate_json(JSON.stringify(request))) as unknown;
  return method === 'execute' ? engine.execute(request as CoreCommandRequest) : engine.calculate(request as CoreCalculationRequest);
};
