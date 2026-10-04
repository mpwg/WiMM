// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

/** Prüft auch Cargo-Buildskriptwarnungen, die rustc-Lintflags nicht erfassen. */
export function runWithWarningCheck(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ['inherit', 'pipe', 'pipe'] });
    let warning = false;
    let text = '';
    function observe(chunk, stream) {
      stream.write(chunk);
      text = (text + stripVTControlCharacters(chunk.toString())).slice(-16_384);
      if (/^\s*(?:warning(?::|\[)|warn\b)/im.test(text)) warning = true;
    }
    child.stdout.on('data', (chunk) => observe(chunk, process.stdout));
    child.stderr.on('data', (chunk) => observe(chunk, process.stderr));
    child.on('error', (error) => { console.error(error); resolve(1); });
    child.on('close', (code) => {
      if (code === 0 && warning) console.error('Der Build enthält Warnungen und wurde abgewiesen.');
      resolve(code === 0 && !warning ? 0 : (code || 1));
    });
  });
}
