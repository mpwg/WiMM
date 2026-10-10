// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect,it } from 'vitest';
import { sqliteFixture } from './sqlite-fixture.js';
import { snapshotCases,runSnapshotCase } from './contracts/snapshot-catalog.js';
import { rebuildCases,runRebuildCase } from './contracts/rebuild-catalog.js';
import { mergeCases,runMergeCase } from './contracts/merge-catalog.js';
import { versionCases,runVersionCase } from './contracts/version-catalog.js';
for(const scenario of snapshotCases)it(`Ziel-ORM/echte SQLite: ${scenario}`,async()=>{await expect(runSnapshotCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of rebuildCases)it(`Ziel-ORM/echte SQLite: ${scenario}`,async()=>{await expect(runRebuildCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of mergeCases)it(`Ziel-ORM/echte SQLite: Merge ${scenario}`,async()=>{await expect(runMergeCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of versionCases)it(`Ziel-ORM/echte SQLite: Version ${scenario}`,async()=>{await expect(runVersionCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
import {createEncryptedJsonSnapshotProtector,canonicalJsonBytes} from '../../packages/crypto/src/index.js';
import {p5Snapshot,id,normalized} from './contracts/snapshot-catalog.js';
import type {LocalSnapshot} from '../../packages/storage/src/index.js';
it('Ziel-ORM: echter geschützter P5-Backup und Rust-Prozessneustart ohne Originaländerung',async()=>{
 const fixture=await sqliteFixture('orm');try {
  const source=p5Snapshot();await fixture.storage.replaceSnapshot(source);const before=normalized(await fixture.storage.exportSnapshot(source.spaceId));
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));const ciphertext=await protector.seal(before);const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new Uint8Array(canonicalJsonBytes(before)))).toString('base64url');
  const proof=await fixture.backups.persist({profileId:before.profileId,spaceId:before.spaceId,epoch:before.epoch,snapshotHash:hash,ciphertext});await fixture.restart();const saved=await fixture.backups.read(proof);expect(saved).toEqual(ciphertext);expect(await protector.unseal(saved)).toEqual(before);expect(new TextDecoder().decode(saved)).not.toContain('aggregateType');
  await expect(fixture.backups.persist({profileId:before.profileId,spaceId:before.spaceId,epoch:before.epoch,snapshotHash:hash,ciphertext:new Uint8Array([99])})).rejects.toMatchObject({code:'WRITE_FAILED',commitState:'notCommitted'});await expect(fixture.backups.read({...proof,epoch:id(9998)})).rejects.toMatchObject({code:'WRITE_FAILED',commitState:'notCommitted'});expect(normalized(await fixture.storage.exportSnapshot(source.spaceId))).toEqual(before);
 }finally{await fixture.close();}
},30_000);
