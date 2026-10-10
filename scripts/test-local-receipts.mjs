// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { mkdir } from 'node:fs/promises';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
await mkdir('test-results/ar04/wasm', { recursive: true });
for (const [command, args] of [
  ['cargo', ['test', '--locked', '-p', 'wimm-local-dal', '--all-features']],
  ['cargo', ['build','--locked','-p','wimm-client-crypto','--target','wasm32-unknown-unknown']],
  ['cargo', ['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/debug/wimm_client_crypto.wasm','test-results/ar04/crypto']],
  ['cargo', ['build','--locked','-p','wimm-core-bindings','--no-default-features','--features','wasm,contract-probe','--target','wasm32-unknown-unknown']],
  ['cargo', ['run','--locked','-p','wimm-wasm-glue','--','target/wasm32-unknown-unknown/debug/wimm_core_bindings.wasm','test-results/ar04/core']],
  ['cargo', ['build', '--locked', '-p', 'wimm-local-dal', '--lib', '--features', 'receipt-probe', '--target', 'wasm32-unknown-unknown']],
  ['cargo', ['run', '--locked', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/debug/wimm_local_dal.wasm', 'test-results/ar04/wasm']],
  ['pnpm', ['exec', 'playwright', 'test', '--config', 'tests/local-receipts/config.ts', ...process.argv.slice(2)]]
]) {
  const status = await runWithWarningCheck(command, args); if (status !== 0) process.exit(status);
}
