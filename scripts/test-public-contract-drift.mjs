// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const source = 'crates/public-contracts/src/envelopes.rs';
const root = 'packages/contracts/generated/public-v2/schema';
const original = await readFile(source, 'utf8');
const marker = 'pub enum Role {\n    Admin,\n    Member,\n    Viewer,\n}';
assert.equal(original.split(marker).length, 2);
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const files = [...manifest.files, 'manifest.json'];
const hashes = async () => Promise.all(files.map(async (file) => createHash('sha256').update(await readFile(`${root}/${file}`)).digest('hex')));
const before = await hashes();
let result;
try {
  await writeFile(source, original.replace(marker, marker.replace('    Viewer,', '    Viewer,\n    SyntheticDrift,')));
  result = spawnSync('cargo', ['run', '--locked', '-p', 'wimm-contract-schema', '--', '--public', '--check', resolve(root)], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Vertragsdrift:/);
  assert.deepEqual(await hashes(), before);
} finally { await writeFile(source, original); }
assert.equal(await readFile(source, 'utf8'), original);
const restored = spawnSync('cargo', ['run', '--locked', '-p', 'wimm-contract-schema', '--', '--public', '--check', resolve(root)], { encoding: 'utf8' });
assert.equal(restored.status, 0, restored.stderr); assert.deepEqual(await hashes(), before);
await writeFile('test-results/public-contracts/source-drift.log', result.stderr + '\nÖffentliche Quelle wiederhergestellt; unveränderte Hashes; Prüfmodus erfolgreich.\n');
console.log('Öffentlicher Rust-Quellendrift erkannt, Quelle wiederhergestellt, kein Schema überschrieben.');
