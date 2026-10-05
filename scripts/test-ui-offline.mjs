// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const cli = require.resolve('@playwright/test/cli');
const warningPolicy = new URL('./warnings-as-errors.mjs', import.meta.url).href;
const result = spawnSync(process.execPath, [cli, 'test', '--config', 'tests/ui/pwa.config.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WIMM_CLIENT: 'web',
    WIMM_BUILD: '1',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${warningPolicy}`
  }
});

if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
