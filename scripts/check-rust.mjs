// SPDX-License-Identifier: AGPL-3.0-or-later
import './check-rust-toolchain.mjs';
import { runWithWarningCheck } from './run-with-warning-check.mjs';

const manifest = ['--manifest-path', 'apps/desktop/src-tauri/Cargo.toml'];
const commands = {
  fmt: ['fmt', ...manifest, '--all', '--', '--check'],
  clippy: ['clippy', ...manifest, '--locked', '--all-targets', '--', '-D', 'warnings'],
  test: ['test', ...manifest, '--locked']
};
const args = commands[process.argv[2]];
if (!args) throw new Error('Rust-Prüfung benötigt fmt, clippy oder test.');
if (!process.exitCode) process.exitCode = await runWithWarningCheck('cargo', args);
