// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = 'packages/contracts/generated/local-v2/schema';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const files = [...manifest.files, 'manifest.json'];
const hashes = async () => Promise.all(files.map(async (file) => createHash('sha256').update(await readFile(`${root}/${file}`)).digest('hex')));
const before = await hashes();
const evidence=[];
for (const [source,marker,replacement] of [
 ['crates/local-contracts/src/errors.rs','pub enum LocalFormStatus {\n    FormValid,\n}','pub enum LocalFormStatus {\n    FormValid,\n    SyntheticDrift,\n}'],
 ['crates/local-contracts/src/checkpoint_v2.rs','    recovery:Option<Vec<u8>>','    #[serde(rename="syntheticRecoveryDrift")]\n    recovery:Option<Vec<u8>>'],
]) {
 const original=await readFile(source,'utf8');assert.equal(original.split(marker).length,2);
 let result;
 try {
  await writeFile(source, original.replace(marker,replacement));
  result=spawnSync('cargo',['run','--locked','-p','wimm-contract-schema','--','--local','--check',resolve(root)],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Vertragsdrift:/);assert.deepEqual(await hashes(),before);
 } finally {await writeFile(source,original);}
 assert.equal(await readFile(source,'utf8'),original);
 const restored=spawnSync('cargo',['run','--locked','-p','wimm-contract-schema','--','--local','--check',resolve(root)],{encoding:'utf8'});
 assert.equal(restored.status,0,restored.stderr);assert.deepEqual(await hashes(),before);
 evidence.push(result.stderr);
}
await mkdir('test-results/local-contracts',{recursive:true});
await writeFile('test-results/local-contracts/source-drift.log',evidence.join('\n')+'\nLokale Quellen wiederhergestellt; unveränderte Hashes; Prüfmodus erfolgreich.\n');
console.log('Lokaler Rust-Enum- und Checkpointfelddrift erkannt, Quellen wiederhergestellt, kein Schema überschrieben.');
