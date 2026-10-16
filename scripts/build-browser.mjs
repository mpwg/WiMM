import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

const run = (program, args) => execFileSync(program, args, { stdio: 'inherit' });
run('cargo', ['build', '--locked', '--release', '-p', 'wimm-wasm', '--target', 'wasm32-unknown-unknown']);
run(process.env.WASM_BINDGEN || 'wasm-bindgen', ['--target', 'web', '--out-dir', 'packages/browser/wasm', 'target/wasm32-unknown-unknown/release/wimm_wasm.wasm']);
run('pnpm', ['exec', 'tsc']);
await build({ entryPoints: ['packages/browser/src/index.ts', 'packages/browser/src/worker.ts'], bundle: true, format: 'esm', target: 'es2022', outdir: 'packages/browser/dist' });
// wasm-bindgen resolves its binary relative to worker.js after bundling.
cpSync('packages/browser/wasm/wimm_wasm_bg.wasm', 'packages/browser/dist/wimm_wasm_bg.wasm');
mkdirSync('tests/browser/dist', { recursive: true });
cpSync('packages/browser/dist', 'tests/browser/dist', { recursive: true });
