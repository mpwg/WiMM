// SPDX-License-Identifier: AGPL-3.0-or-later
import './check-rust-toolchain.mjs';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
for (const args of [['fmt', '--all', '--', '--check'], ['clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings'], ['test', '--workspace', '--locked']]) {
  const code = await runWithWarningCheck('cargo', args);
  if (code !== 0) process.exit(code);
}
