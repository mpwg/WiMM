// SPDX-License-Identifier: AGPL-3.0-or-later
import { callTypedMoney, type MoneyFixtureRequest } from '../../../tests/contract-bindings/money-v2.js';
import type * as Binding from '../../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';
const url = new URL(window.location.href).searchParams.get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_core_bindings.js')) throw new Error('Die lokale WASM-Testdatei fehlt.');
const wasm = await import(/* @vite-ignore */ url) as typeof Binding;
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die lokale WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
declare global { interface Window { typedMoneyV2Probe: (request: MoneyFixtureRequest) => unknown } }
window.typedMoneyV2Probe = (request) => callTypedMoney(wasm, request);
