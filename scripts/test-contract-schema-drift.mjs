// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const source = 'crates/finance-types/src/versions.rs';
const root = 'packages/contracts/generated/private-v2/schema';
const original = await readFile(source, 'utf8');
const marker = 'pub const ENGINE_BINDING_VERSION: u32 = 2;';
assert.equal(original.split(marker).length, 2, 'Negative Driftprüfung verlangt eindeutig die bestehende Versionsquelle.');
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const files = [...manifest.files, 'manifest.json'];
const hashes = async () => Promise.all(files.map(async (file) => createHash('sha256').update(await readFile(`${root}/${file}`)).digest('hex')));
const before = await hashes();
let result;
try {
  await writeFile(source, original.replace(marker, 'pub const ENGINE_BINDING_VERSION: u32 = 3;'));
  result = spawnSync('cargo', ['run', '--locked', '-p', 'wimm-contract-schema', '--', '--check', resolve(root)], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'Absichtlicher Rust-Vertragsdrift muss die CI-Prüfung ablehnen.');
  assert.match(result.stderr, /Vertragsdrift:/);
  assert.deepEqual(await hashes(), before, 'Driftprüfung darf versionierte Dateien nicht überschreiben.');
} finally {
  await writeFile(source, original);
}
assert.equal(await readFile(source, 'utf8'), original);
const restored = spawnSync('cargo', ['run', '--locked', '-p', 'wimm-contract-schema', '--', '--check', resolve(root)], { encoding: 'utf8' });
assert.equal(restored.status, 0, restored.stderr);
assert.deepEqual(await hashes(), before);
await writeFile('test-results/typed-state-bindings/schema-source-drift.log', result.stderr + '\nQuelle wiederhergestellt; Prüfmodus erfolgreich; versionierte Hashes unverändert.\n');
console.log('Absichtlicher Rust-Schemaquellendrift abgewiesen, Quelle wiederhergestellt, keine generierte Datei überschrieben.');
