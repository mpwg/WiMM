// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const mode = process.argv.includes('--performance') ? 'performance' : process.argv.includes('--matrix') ? 'matrix' : process.argv.includes('--zoom') ? 'zoom' : 'browsers';
for (const client of mode === 'browsers' ? ['web', 'desktop'] : ['web']) {
  const result = spawnSync(process.execPath, [cli, 'test', '--config', 'tests/acceptance/config.ts', ...(mode === 'performance' ? ['tests/acceptance/performance.spec.ts'] : [])], {
    stdio: 'inherit', env: { ...process.env, WIMM_CLIENT: client, WIMM_MATRIX: mode === 'matrix' || mode === 'performance' ? '1' : '0', WIMM_REAL_ZOOM: mode === 'zoom' ? '1' : '0', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./warnings-as-errors.mjs', import.meta.url).href}` }
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) { process.exitCode = result.status ?? 1; }
}
