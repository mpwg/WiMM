// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { mkdir } from 'node:fs/promises';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
await mkdir('test-results/ar04/wasm', { recursive: true });
for (const [command, args] of [
  ['cargo', ['test', '--locked', '-p', 'wimm-local-dal', '--all-features', '--test', 'sqlite_receipts']],
  ['cargo', ['build', '--locked', '-p', 'wimm-local-dal', '--lib', '--features', 'receipt-probe', '--target', 'wasm32-unknown-unknown']],
  ['cargo', ['run', '--locked', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/debug/wimm_local_dal.wasm', 'test-results/ar04/wasm']],
  ['pnpm', ['exec', 'playwright', 'test', '--config', 'tests/local-receipts/config.ts', ...process.argv.slice(2)]]
]) {
  const status = await runWithWarningCheck(command, args); if (status !== 0) process.exit(status);
}
