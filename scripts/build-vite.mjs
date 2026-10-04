// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(resolve('package.json'));
const viteDirectory = dirname(require.resolve('vite/package.json'));
const child = spawn(process.execPath, [resolve(viteDirectory, 'bin/vite.js'), 'build'], {
  stdio: ['inherit', 'inherit', 'pipe']
});
let diagnostics = false;
// Vites nativer Reporter umgeht teilweise customLogger und onLog.
// Diagnoseausgaben bleiben sichtbar und machen auch einen sonst erfolgreichen Build ungültig.
child.stderr.on('data', (chunk) => {
  if (chunk.toString().trim()) diagnostics = true;
  process.stderr.write(chunk);
});
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('close', (code) => {
  if (code === 0 && diagnostics) console.error('Der Vite-Build enthält Diagnoseausgaben und wurde abgewiesen.');
  process.exitCode = code === 0 && !diagnostics ? 0 : (code || 1);
});
