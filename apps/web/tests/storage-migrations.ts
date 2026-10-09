// SPDX-License-Identifier: AGPL-3.0-or-later
import {BrowserEncryptedBackupPort} from '@wimm/browser-adapters';
import {createMigrationBackupVerifier} from '@wimm/application';
import {createEncryptedJsonSnapshotProtector} from '@wimm/crypto';
import {IndexedDbStorageAdapter,type LocalSnapshot} from '@wimm/storage';
import {migrationCases,runMigrationCase,migrationSnapshotHash} from '../../../tests/storage/contracts/migration-catalog.js';
import {profileId,id} from '../../../tests/storage/contracts/snapshot-catalog.js';
declare global{interface Window{migrationProbe:(scenario:typeof migrationCases[number])=>Promise<void>}}
window.migrationProbe=async(scenario)=>{
 const name=`wimm:synthetic-migration:${crypto.randomUUID()}`;
 const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);
 const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
 const verifier=createMigrationBackupVerifier(backups,protector,migrationSnapshotHash);
 let storage=new IndexedDbStorageAdapter(profileId,name,verifier);
 await runMigrationCase(scenario,{get storage(){return storage;},forProfile:(otherProfile)=>new IndexedDbStorageAdapter(otherProfile,name,verifier),backups,get migration(){return storage;},get indices(){return storage;},async restart(){await storage.close();storage=new IndexedDbStorageAdapter(profileId,name,verifier);return storage;},close:()=>storage.close()});
};
import {runIndexMaintenanceCase} from '../../../tests/storage/contracts/migration-catalog.js';
declare global{interface Window{indexMaintenanceProbe:()=>Promise<void>}}
window.indexMaintenanceProbe=async()=>{
 const name=`wimm:synthetic-index-maintenance:${crypto.randomUUID()}`;const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));const verifier=createMigrationBackupVerifier(backups,protector,migrationSnapshotHash);let storage=new IndexedDbStorageAdapter(profileId,name,verifier);
 await runIndexMaintenanceCase({get storage(){return storage;},forProfile:(otherProfile)=>new IndexedDbStorageAdapter(otherProfile,name,verifier),backups,get migration(){return storage;},get indices(){return storage;},async restart(){await storage.close();storage=new IndexedDbStorageAdapter(profileId,name,verifier);return storage;},close:()=>storage.close()});
};
import {runIndexPerformanceCase} from '../../../tests/storage/contracts/migration-catalog.js';
declare global{interface Window{indexPerformanceProbe:()=>ReturnType<typeof runIndexPerformanceCase>}}
window.indexPerformanceProbe=async()=>{
 const name=`wimm:synthetic-index-performance:${crypto.randomUUID()}`;const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));const verifier=createMigrationBackupVerifier(backups,protector,migrationSnapshotHash);let storage=new IndexedDbStorageAdapter(profileId,name,verifier);
 return runIndexPerformanceCase({get storage(){return storage;},forProfile:(otherProfile)=>new IndexedDbStorageAdapter(otherProfile,name,verifier),backups,get migration(){return storage;},get indices(){return storage;},async restart(){await storage.close();storage=new IndexedDbStorageAdapter(profileId,name,verifier);return storage;},close:()=>storage.close()});
};

import {LOCAL_INDEX_MIGRATION,LOCAL_INDEX_MIGRATION_PLAN, equalMigrationSnapshot} from '@wimm/storage';
import {LocalMigrationCoordinator} from '@wimm/application';
import {p5Snapshot} from '../../../tests/storage/contracts/snapshot-catalog.js';
import type {EncryptedBackupReceipt} from '@wimm/contracts';
declare global{interface Window{migrationProcessProbe:(mode:'migrate'|'read')=>Promise<boolean>;migrationAbortAfterJournalProbe:()=>Promise<boolean>}}
window.migrationProcessProbe=async(mode)=>{
 const name='wimm:synthetic-migration-process-restart';const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));const storage=new IndexedDbStorageAdapter(profileId,name,createMigrationBackupVerifier(backups,protector,migrationSnapshotHash));
 try{
  if(mode==='migrate'){
   await storage.replaceSnapshot(p5Snapshot());
   const coordinator=new LocalMigrationCoordinator(storage,p5Snapshot().spaceId,[LOCAL_INDEX_MIGRATION],{protector,migration:storage,snapshotHash:migrationSnapshotHash,backups:{async persist(input){const receipt=await backups.persist(input);localStorage.setItem('wimm:synthetic-migration-receipt',JSON.stringify(receipt));return receipt;}}});
   await coordinator.migrate(LOCAL_INDEX_MIGRATION_PLAN,{isCancelled:()=>false,onCancel:()=>()=>{}});
  }
  const snapshot=await storage.exportSnapshot(p5Snapshot().spaceId);const receipt=JSON.parse(localStorage.getItem('wimm:synthetic-migration-receipt')!) as EncryptedBackupReceipt;const original=await protector.unseal(await backups.read(receipt));
  return snapshot.storageSchemaVersion===2&&equalMigrationSnapshot({...snapshot,storageSchemaVersion:1},original)&&(await storage.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'category',reference:id(13),limit:100})).length===1;
 }finally{await storage.close();}
};
window.migrationAbortAfterJournalProbe=async()=>{
 const name=`wimm:synthetic-migration-abort:${crypto.randomUUID()}`;const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));let storage=new IndexedDbStorageAdapter(profileId,name,createMigrationBackupVerifier(backups,protector,migrationSnapshotHash));
 try{
  await storage.replaceSnapshot(p5Snapshot());const before=await storage.exportSnapshot(p5Snapshot().spaceId);const receipt=await backups.persist({profileId:before.profileId,spaceId:before.spaceId,epoch:before.epoch,snapshotHash:await migrationSnapshotHash(before),ciphertext:await protector.seal(before)});
  let checkpoints=0,aborted=false;try{await storage.migrate({plan:LOCAL_INDEX_MIGRATION_PLAN,expectedSnapshot:before,backup:receipt},{isCancelled:()=>++checkpoints>=5,onCancel:()=>()=>{}});}catch{aborted=true;}
  await storage.close();storage=new IndexedDbStorageAdapter(profileId,name);
  return aborted&&equalMigrationSnapshot(await storage.exportSnapshot(before.spaceId),before)&&equalMigrationSnapshot(await protector.unseal(await backups.read(receipt)),before);
 }finally{await storage.close();}
};
import {runIndexProfileCase} from '../../../tests/storage/contracts/migration-catalog.js';
declare global{interface Window{indexProfileProbe:()=>Promise<void>}}
window.indexProfileProbe=async()=>{
 const name=`wimm:synthetic-index-profile:${crypto.randomUUID()}`;const backups=new BrowserEncryptedBackupPort({next:()=>id(9999)},`${name}:backups`);const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));const verifier=createMigrationBackupVerifier(backups,protector,migrationSnapshotHash);let storage=new IndexedDbStorageAdapter(profileId,name,verifier);
 await runIndexProfileCase({get storage(){return storage;},forProfile:(otherProfile)=>new IndexedDbStorageAdapter(otherProfile,name,verifier),backups,get migration(){return storage;},get indices(){return storage;},async restart(){await storage.close();storage=new IndexedDbStorageAdapter(profileId,name,verifier);return storage;},close:()=>storage.close()});
};
