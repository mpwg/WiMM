// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,it} from 'vitest';
import {createEncryptedJsonSnapshotProtector} from '@wimm/crypto';
import type {Base64Url,EncryptedBackupReceipt,UUID,StorageMigrationPlan} from '@wimm/contracts';
import {LocalMigrationCoordinator,type RegisteredMigrationStep} from './migration-coordinator.js';
import {p5Snapshot} from '../../../tests/storage/contracts/snapshot-catalog.js';
import type {LocalStorageAdapter,LocalSnapshot} from '@wimm/storage';
const step:RegisteredMigrationStep={number:1,from:{storageSchemaVersion:1,domainSchemaVersion:1},to:{storageSchemaVersion:2,domainSchemaVersion:1},destructive:true};
const plan:StorageMigrationPlan={expectedMigrationNumber:0,from:step.from,steps:[step]};
const backupId='23000000-0000-4000-8000-000000000001' as UUID;
function setup(){const snapshot=p5Snapshot();let cancelled=false,commits=0,saved:Uint8Array|undefined;let failure:'none'|'seal'|'backup'|'receipt'|'cancel-seal'|'cancel-backup'='none';
 const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
 const storage={profileId:snapshot.profileId,exportSnapshot:async()=>structuredClone(snapshot)} as Pick<LocalStorageAdapter,'profileId'|'exportSnapshot'>;
 const cancellation={isCancelled:()=>cancelled,onCancel:()=>()=>{}};
 const hash='c3ludGhldGlzY2hlLW9yaWdpbmFsYmFzaXM' as Base64Url;
 const ports={snapshotHash:async()=>hash,protector:{seal:async(source:LocalSnapshot)=>{if(failure==='seal')throw new Error('Synthetisch fehlender Schlüssel');const result=await protector.seal(source);if(failure==='cancel-seal')cancelled=true;return result;},unseal:(bytes:Uint8Array)=>protector.unseal(bytes)},backups:{persist:async(input:{ciphertext:Uint8Array;profileId:UUID;spaceId:UUID;epoch:UUID;snapshotHash:Base64Url})=>{if(failure==='backup')throw new Error('Synthetischer Sicherungsfehler');saved=input.ciphertext.slice();if(failure==='cancel-backup')cancelled=true;return {backupId,profileId:input.profileId,spaceId:input.spaceId,epoch:input.epoch,snapshotHash:failure==='receipt'?'ZnJlbWQ' as Base64Url:input.snapshotHash};}},migration:{migrate:async(input:{expectedSnapshot:LocalSnapshot;backup:EncryptedBackupReceipt|undefined})=>{expect(input.expectedSnapshot).toEqual(snapshot);expect(input.backup?.snapshotHash).toBe(hash);commits++;}}};
 return {coordinator:new LocalMigrationCoordinator(storage,snapshot.spaceId,[step],ports),cancellation,snapshot,setFailure:(f:typeof failure)=>{failure=f;},cancel:()=>{cancelled=true;},commits:()=>commits,saved:()=>saved,unsealSaved:()=>protector.unseal(saved!)};
}
it('bestätigt echte authentifizierte Verschlüsselung und passenden Backupbeleg vor Übergabe an den Adapter',async()=>{const s=setup();const receipt=await s.coordinator.migrate(plan,s.cancellation);expect(receipt?.backupId).toBe(backupId);expect(s.commits()).toBe(1);expect(s.saved()).toBeInstanceOf(Uint8Array);expect(new TextDecoder().decode(s.saved())).not.toContain('aggregateType');expect(await s.unsealSaved()).toEqual(s.snapshot);});
it.each(['seal','backup','receipt','cancel-seal','cancel-backup'] as const)('verhindert Adaptermutation nach %s und bewahrt den Originalsnapshot',async(f)=>{const s=setup();const before=structuredClone(s.snapshot);s.setFailure(f);await expect(s.coordinator.migrate(plan,s.cancellation)).rejects.toThrow(/Synthetisch|Sicherung|abgebrochen/);expect(s.commits()).toBe(0);expect(s.snapshot).toEqual(before);});
it('weist unbekannte und rückwärtsgerichtete Pläne vor Sicherung/Mutation ab',async()=>{const s=setup();await expect(s.coordinator.migrate({...plan,steps:[{...step,number:2}]},s.cancellation)).rejects.toThrow('Migrationsplan');await expect(s.coordinator.migrate({...plan,steps:[{...step,to:{storageSchemaVersion:1,domainSchemaVersion:1}}]},s.cancellation)).rejects.toThrow('Migrationsplan');expect(s.saved()).toBeUndefined();expect(s.commits()).toBe(0);});
it('bricht vor dem Snapshotlesen ohne Schreibzugriff ab',async()=>{const s=setup();s.cancel();await expect(s.coordinator.migrate(plan,s.cancellation)).rejects.toThrow('abgebrochen');expect(s.saved()).toBeUndefined();expect(s.commits()).toBe(0);});
