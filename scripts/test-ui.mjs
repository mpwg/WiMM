// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const warningPolicy = new URL('./warnings-as-errors.mjs', import.meta.url).href;
for (const client of ['web', 'desktop']) {
  const args = ['test'];
  if (client === 'desktop') args.push('--config', 'tests/ui/desktop.config.ts');
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WIMM_CLIENT: client,
      WIMM_BUILD: process.argv.includes('--build') ? '1' : '0',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${warningPolicy}`
    }
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
