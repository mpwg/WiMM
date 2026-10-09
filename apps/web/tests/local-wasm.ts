// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../../packages/contracts/generated/local-v2/wasm/wimm_local_contracts.js';
const url = new URL(window.location.href).searchParams.get('wasmUrl');
if (url === null || !url.startsWith('/@fs/') || !url.endsWith('/wimm_local_contracts.js')) throw new Error('Die lokale WASM-Testdatei fehlt.');
const wasm = await import(/* @vite-ignore */ url) as typeof Binding;
const response = await fetch(url.replace(/\.js$/, '_bg.wasm'));
if (!response.ok) throw new Error('Die lokale WASM-Testdatei ist nicht lesbar.');
await wasm.default({ module_or_path: await response.arrayBuffer() });
declare global { interface Window { localMigrationProbe: (request: unknown) => unknown } }
window.localMigrationProbe = request => {
  try { return wasm.validate_local_migration_form_v2(request as Binding.StorageMigrationPlan); }
  catch (error) { return error; }
};
