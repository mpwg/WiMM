// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,it} from 'vitest';
import {exportLocalAreaSnapshot} from './local-snapshot-export.js';
import {createLocalProfile} from './profile.js';
import {ApplicationActivity} from './activity.js';
import type {ProfileScreen} from './profile-application.js';
import {MemoryStorageAdapter,LocalAreaService,type LocalSnapshot} from '@wimm/storage';
import {createEncryptedJsonSnapshotProtector,unlockUserVaultWithRecoveryCode} from '@wimm/crypto';

async function setup(){
 const created=await createLocalProfile('Synthetische Exportpassphrase 2026',{next:()=>crypto.randomUUID()});const session=await unlockUserVaultWithRecoveryCode(created.profile.vault,created.recoveryCode);const profileId=created.profile.profileId,spaceId=created.profile.selectedAreaId;
 let screen:ProfileScreen={kind:'unlocked',profile:created.profile,vault:session};const activity=new ApplicationActivity();const storage=new MemoryStorageAdapter(profileId);const epoch=crypto.randomUUID();await storage.initializeArea(spaceId,epoch);
 return {profileId,spaceId,activity,storage,session:session,epoch,profile:{activity,getSnapshot:()=>({screen,notice:undefined,busy:false,changing:false})},setScreen:(value:ProfileScreen)=>{screen=value;}};
}
it('exportiert den gespeicherten lokalen Bereich mit echter Verschlüsselung ohne Schlüssel oder Tresor im Snapshot',async()=>{
 const s=await setup();const before=await s.storage.exportSnapshot(s.spaceId);const bytes=await exportLocalAreaSnapshot(s.profile,()=>s.storage,s.profileId,s.spaceId,{next:()=>crypto.randomUUID()});
 const key=s.session.spaces.find(entry=>entry.spaceId===s.spaceId)!.key;expect(await createEncryptedJsonSnapshotProtector<LocalSnapshot>(key).unseal(bytes)).toEqual(before);expect(new TextDecoder().decode(bytes)).not.toContain('aggregates');expect(s.activity.financeBusy).toBe(false);
 const service=new LocalAreaService(s.storage,s.spaceId,{connected:false,initialEpoch:s.epoch});await service.replaceEncryptedSnapshot(createEncryptedJsonSnapshotProtector(key),bytes);expect(await s.storage.exportSnapshot(s.spaceId)).toEqual(before);
});
it('weist fremde oder gesperrte Bereiche vor dem Lesen ab',async()=>{
 const s=await setup();let opened=0;const factory=()=>{opened++;return s.storage;};await expect(exportLocalAreaSnapshot(s.profile,factory,s.profileId,crypto.randomUUID(),{next:()=>crypto.randomUUID()})).rejects.toThrow('entsperrten Bereich');s.setScreen({kind:'loading'});await expect(exportLocalAreaSnapshot(s.profile,factory,s.profileId,s.spaceId,{next:()=>crypto.randomUUID()})).rejects.toThrow('entsperrten Bereich');expect(opened).toBe(0);expect(s.activity.financeBusy).toBe(false);
});
it('verwirft einen späten Export nach Sitzungswechsel und gibt auch bei Lesefehler die Anwendungssperre frei',async()=>{
 const s=await setup();const original=s.storage.exportSnapshot.bind(s.storage);s.storage.exportSnapshot=async id=>{const result=await original(id);s.setScreen({kind:'loading'});return result;};await expect(exportLocalAreaSnapshot(s.profile,()=>s.storage,s.profileId,s.spaceId,{next:()=>crypto.randomUUID()})).rejects.toThrow('Sitzungswechsel');expect(s.activity.financeBusy).toBe(false);
 const fresh=await setup();fresh.storage.exportSnapshot=async()=>{throw new Error('Synthetischer Lesefehler');};await expect(exportLocalAreaSnapshot(fresh.profile,()=>fresh.storage,fresh.profileId,fresh.spaceId,{next:()=>crypto.randomUUID()})).rejects.toThrow('Synthetischer Lesefehler');expect(fresh.activity.financeBusy).toBe(false);
});
