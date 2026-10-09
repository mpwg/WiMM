// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
for (const args of [
  ['exec', 'vitest', 'run', 'packages/contracts/src/public-generation.test.ts'],
  ['exec', 'playwright', 'test', '--config', 'tests/contract-bindings/config.ts', 'public-wasm.spec.ts']
]) {
  const status = await runWithWarningCheck('pnpm', args);
  if (status !== 0) process.exit(status);
}
const drift = await runWithWarningCheck('node', ['scripts/test-public-contract-drift.mjs']);
if (drift !== 0) process.exit(drift);
