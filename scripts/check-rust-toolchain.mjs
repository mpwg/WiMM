// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../rust-toolchain.toml', import.meta.url), 'utf8');
const version = config.match(/^channel = "([\d.]+)"$/m)?.[1];
const actual = execFileSync('rustc', ['--version'], { encoding: 'utf8' }).split(' ')[1];
if (!version || actual !== version) {
  console.error(`Rust ${version} wird benötigt; installiert ist ${actual}. Bitte die Toolchain aus rust-toolchain.toml verwenden.`);
  process.exitCode = 1;
}
