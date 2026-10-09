// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
for (const args of [
  ['exec', 'vitest', 'run', 'packages/contracts/src/storage-error-generation.test.ts', 'packages/contracts/src/local-generation.test.ts', 'packages/contracts/src/snapshot-generation.test.ts', 'packages/contracts/src/stored-aggregate.test.ts', 'packages/contracts/src/port-generation.test.ts'],
  ['exec', 'playwright', 'test', '--config', 'tests/contract-bindings/config.ts', 'local-wasm.spec.ts']
]) {
  const status = await runWithWarningCheck('pnpm', args);
  if (status !== 0) process.exit(status);
}

const drift = await runWithWarningCheck('node', ['scripts/test-local-contract-drift.mjs']);
if (drift !== 0) process.exit(drift);
