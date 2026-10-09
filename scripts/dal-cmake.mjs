#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// DAL01: explizite SDK-Auswahl für den unveränderten Fremd-MySQL-Clientbuild.
import { spawnSync } from 'node:child_process';
const executable = process.env.WIMM_DAL_CMAKE;
if (!executable) throw new Error('WIMM_DAL_CMAKE muss den tatsächlichen CMake-Pfad nennen.');
const args = process.argv.slice(2);
if (process.env.WIMM_DAL_OPENSSL_DIR && args.some(arg => /mysqlclient-src-[^/]+\/source$/.test(arg))) {
  // MySQLs macOS-Systemsuche ignoriert OPENSSL_ROOT_DIR und bevorzugt den
  // generischen Homebrew-Link. Der dokumentierte WITH_SSL-Parameter bindet
  // stattdessen die ausdrücklich gewählte Installation, ohne Quellpatch.
  args.push(`-DWITH_SSL=${process.env.WIMM_DAL_OPENSSL_DIR}`);
}
const child = spawnSync(executable, args, { stdio: 'inherit' });
if (child.error) throw new Error('Der konfigurierte CMake-Starter ist nicht verfügbar.');
process.exit(child.status ?? 1);
