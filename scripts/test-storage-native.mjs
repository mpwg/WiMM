// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
mkdirSync('test-results', { recursive: true });
const output = openSync('test-results/storage-contract-build.jsonl', 'w');
const build = spawnSync('cargo', ['test', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--locked', '--no-run', '--message-format=json'], { stdio: ['inherit', output, 'inherit'], env: { ...process.env, RUSTFLAGS: '-Dwarnings' } });
closeSync(output);
if (build.status !== 0) process.exit(build.status ?? 1);
const tests = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.ts', 'tests/storage/native-snapshot.test.ts'], { stdio: 'inherit' });
process.exit(tests.status ?? 1);
