// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runWithWarningCheck } from './run-with-warning-check.mjs';
async function run(command, args, options = {}) {
  const code = await runWithWarningCheck(command, args, options);
  if (code !== 0) process.exit(code);
}
await mkdir('test-results/dal-proof/wasm', { recursive: true });
await run('cargo', ['test', '--locked', '-p', 'wimm-dal-proof']);
const driverEnv = { ...process.env, CARGO_TARGET_DIR: resolve('test-results/dal-proof/native-drivers') };
if (process.platform === 'darwin') {
  const cmake = process.env.WIMM_DAL_CMAKE ?? resolve('test-results/dal-proof/cmake-tools/bin/cmake');
  const openssl = process.env.WIMM_DAL_OPENSSL_DIR ?? '/opt/homebrew/opt/openssl@3.5';
  await access(cmake); await access(openssl);
  Object.assign(driverEnv, {
    CMAKE: resolve('scripts/dal-cmake.mjs'), WIMM_DAL_CMAKE: cmake, WIMM_DAL_OPENSSL_DIR: openssl,
    OPENSSL_DIR: openssl, PKG_CONFIG_PATH: `${openssl}/lib/pkgconfig`
  });
}
await run('cargo', ['build', '--locked', '-p', 'wimm-dal-proof', '--features', 'postgres-build,mysql-build'], { env: driverEnv });
let archiver = process.env.WIMM_WASM_AR;
if (!archiver && process.platform === 'darwin') {
  const candidate = '/opt/homebrew/opt/llvm/bin/llvm-ar';
  try { await access(candidate); archiver = candidate; }
  catch { throw new Error('WIMM_WASM_AR muss einen WASM-fähigen LLVM-Archivierer nennen.'); }
}
if (archiver) execFileSync(archiver, ['--version'], { stdio: 'ignore' });
await run('cargo', ['build', '--locked', '-p', 'wimm-dal-proof', '--lib', '--target', 'wasm32-unknown-unknown'], { env: { ...process.env, ...(archiver ? { AR_wasm32_unknown_unknown: archiver } : {}) } });
await run('cargo', ['run', '--locked', '-p', 'wimm-wasm-glue', '--', 'target/wasm32-unknown-unknown/debug/wimm_dal_proof.wasm', 'test-results/dal-proof/wasm']);
await run('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/dal-proof/config.ts', ...process.argv.slice(2)]);
