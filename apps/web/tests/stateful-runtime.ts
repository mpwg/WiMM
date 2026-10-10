// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';
import { runStatefulCase } from '../../../tests/contract-bindings/stateful/wasm.mjs';
const url=new URL(location.href).searchParams.get('wasmUrl');
if(url===null||!url.startsWith('/@fs/')||!url.endsWith('/wimm_core_bindings.js'))throw new Error('WASM-Prüfdatei fehlt.');
const wasm=await import(/* @vite-ignore */url) as typeof Binding;
const response=await fetch(url.replace(/\.js$/,'_bg.wasm'));if(!response.ok)throw new Error('WASM-Prüfdatei nicht lesbar.');
await wasm.default({module_or_path:await response.arrayBuffer()});
declare global { interface Window { statefulRuntimeProbe(scenario:unknown):unknown } }
window.statefulRuntimeProbe=scenario=>runStatefulCase(wasm,scenario);
