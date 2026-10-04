// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { spawn } from 'node:child_process';

if (!process.env.npm_execpath) throw new Error('Diese Prüfung bitte über pnpm check:ci starten.');
const warningPolicy = new URL('./warnings-as-errors.mjs', import.meta.url).href;
// pnpm 12 kann ein natives Programm sein; ältere Installationen verwenden JavaScript.
const script = /\.[cm]?js$/.test(process.env.npm_execpath);
const child = spawn(script ? process.execPath : process.env.npm_execpath,
  [...(script ? [process.env.npm_execpath] : []), 'run', 'check:all'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${warningPolicy}` }
});
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('close', (code) => { process.exitCode = code ?? 1; });
