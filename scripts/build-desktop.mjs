// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import './check-rust-toolchain.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { runWithWarningCheck } from './run-with-warning-check.mjs';

if (!process.exitCode) {
  const require = createRequire(resolve('package.json'));
  const manifestPath = require.resolve('@tauri-apps/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cli = resolve(dirname(manifestPath), manifest.bin.tauri);
  process.exitCode = await runWithWarningCheck(process.execPath, [cli, 'build']);
}
