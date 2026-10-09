// SPDX-License-Identifier: AGPL-3.0-or-later
import type {UUID,IdSourcePort} from '@wimm/contracts';
import {createEncryptedJsonSnapshotProtector} from '@wimm/crypto';
import {LocalAreaService,validateLocalSnapshot,type LocalSnapshot,type LocalStorageAdapter} from '@wimm/storage';
import type {ProfileApplication} from './profile-application.js';

/** Gespeicherten Bereich unter derselben Profil-/Finanzsperre verschlüsseln; Schlüssel verlassen die Anwendung nie. */
export async function exportLocalAreaSnapshot(profile:Pick<ProfileApplication,'getSnapshot'|'activity'>,storageForProfile:(profileId:UUID)=>LocalStorageAdapter&{close?():Promise<void>},profileId:UUID,spaceId:UUID,ids:IdSourcePort):Promise<Uint8Array>{
 const screen=profile.getSnapshot().screen;
 if(screen.kind!=='unlocked'||screen.profile.profileId!==profileId||screen.profile.selectedAreaId!==spaceId||!screen.profile.areas.some(area=>area.id===spaceId))throw new Error('Die Bereichssicherung benötigt den aktuell entsperrten Bereich.');
 const release=profile.activity.beginFinance();
 let storage:(LocalStorageAdapter&{close?():Promise<void>})|undefined;
 let key:Uint8Array|undefined;
 try{
  const entry=screen.vault.spaces.filter(entry=>entry.spaceId===spaceId).toSorted((a,b)=>b.keyVersion-a.keyVersion)[0];
  if(entry===undefined)throw new Error('Der Schlüssel für die Bereichssicherung fehlt.');
  key=entry.key.slice();storage=storageForProfile(profileId);
  const service=new LocalAreaService(storage,spaceId,{connected:false,initialEpoch:ids.next()});
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(key);
  const bytes=await service.exportEncryptedSnapshot({seal:snapshot=>protector.seal(validateLocalSnapshot(snapshot,profileId)),unseal:bytes=>protector.unseal(bytes)});
  if(profile.getSnapshot().screen!==screen)throw new Error('Die Bereichssicherung wurde durch einen Sitzungswechsel abgebrochen.');
  return bytes;
 }finally{key?.fill(0);try{await storage?.close?.();}finally{release();}}
}
