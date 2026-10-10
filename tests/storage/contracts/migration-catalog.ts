// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID, Base64Url, CancellationPort, EncryptedBackupPort, EncryptedBackupReceipt, LocalMigrationPort } from '../../../packages/contracts/src/index.js';
import { canonicalJsonBytes,createEncryptedJsonSnapshotProtector } from '../../../packages/crypto/src/index.js';
import { LocalMigrationCoordinator } from '../../../packages/application/src/index.js';
import { LOCAL_INDEX_MIGRATION,LOCAL_INDEX_MIGRATION_PLAN,type LocalSnapshot,type LocalStorageAdapter,type LocalIndexQueryPort } from '../../../packages/storage/src/index.js';
import { equal,id,normalized,p5Snapshot } from './snapshot-catalog.js';
export interface MigrationFixture {
 storage:LocalStorageAdapter;
 forProfile(profileId:UUID):LocalStorageAdapter&{close?():Promise<void>};
 backups:EncryptedBackupPort & {read(receipt:EncryptedBackupReceipt):Promise<Uint8Array>};
 migration:LocalMigrationPort<LocalSnapshot>;
 indices:LocalIndexQueryPort;
 restart():Promise<LocalStorageAdapter>;
 close():Promise<void>;
}
export async function migrationSnapshotHash(snapshot:LocalSnapshot):Promise<Base64Url>{const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(canonicalJsonBytes(snapshot))));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export const migrationCases=['vollständig-und-Neustart','konkurrierender-Originalentwurf','Abbruch-nach-Sicherung','fehlender-Schlüssel','fehlgeschlagene-Sicherung','falscher-Hashbeleg'] as const;
function check(ok:boolean,message:string):asserts ok{if(!ok)throw new Error(message);}
export async function runMigrationCase(scenario:typeof migrationCases[number],fixture:MigrationFixture):Promise<void>{
 try{
  const snapshot=p5Snapshot();await fixture.storage.replaceSnapshot(snapshot);
  const before=await fixture.storage.exportSnapshot(snapshot.spaceId);
  let cancelled=false,receipt:EncryptedBackupReceipt|undefined;
  const cancellation:CancellationPort={isCancelled:()=>cancelled,onCancel:()=>()=>{}};
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  const coordinator=new LocalMigrationCoordinator(fixture.storage,snapshot.spaceId,[LOCAL_INDEX_MIGRATION],{
   protector:scenario==='fehlender-Schlüssel'?{seal:async()=>{throw new Error('Synthetisch fehlender Schlüssel');},unseal:bytes=>protector.unseal(bytes)}:protector,
   snapshotHash:migrationSnapshotHash,
   backups:{async persist(input){
    if(scenario==='fehlgeschlagene-Sicherung')throw new Error('Synthetisch fehlgeschlagene Sicherung');
    receipt=await fixture.backups.persist(input);
    if(scenario==='konkurrierender-Originalentwurf'){
     const operation=before.pending[0]!;await fixture.storage.applyAtomicBatch({expectedRevisions:[],aggregates:[],projections:[],outbox:[{...operation,draft:{spaceId:snapshot.spaceId,note:'Konkurrierender Originalentwurf'}}]});
    }
    if(scenario==='Abbruch-nach-Sicherung')cancelled=true;
    return scenario==='falscher-Hashbeleg'?{...receipt,snapshotHash:'ZnJlbWQ'}:receipt;
   }},migration:fixture.migration
  });
  let failed=false;try{await coordinator.migrate(LOCAL_INDEX_MIGRATION_PLAN,cancellation);}catch{failed=true;}
  if(scenario==='vollständig-und-Neustart'){
   check(!failed,'Registrierte Migration fehlgeschlagen');check(receipt!==undefined,'Sicherungsbeleg fehlt');
   const source=normalized(await fixture.storage.exportSnapshot(snapshot.spaceId));check(source.storageSchemaVersion===2,'Zielversion fehlt');
   check(equal({...source,storageSchemaVersion:1},normalized(before)),'Migration hat Originaldaten verändert');
   const account=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'account',reference:id(11),limit:100});
   const category=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'category',reference:id(13),limit:100});
   const imported=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'import',reference:'synthetische-quellreferenz',limit:100});
   check(equal(account.map(row=>row.id),[id(17)])&&equal(category.map(row=>row.id),[id(17)])&&equal(imported.map(row=>row.id),[id(17)]),'Sekundärreferenzen einschließlich Tombstones passen nicht');
   const restarted=await fixture.restart();check(equal(normalized(await restarted.exportSnapshot(snapshot.spaceId)),source),'Neustart verliert Migrationsstand');
   check(equal(normalized(await protector.unseal(await fixture.backups.read(receipt))),normalized(before)),'Originalsicherung nach Migration/Neustart unvollständig');
   let repeated=false;try{await fixture.migration.migrate({plan:LOCAL_INDEX_MIGRATION_PLAN,expectedSnapshot:before,backup:receipt},cancellation);}catch{repeated=true;}check(repeated,'Alte Migrationsnummer wurde erneut akzeptiert');
  }else{
   check(failed,'Fehlerfall wurde als Migration bestätigt');
   const after=await fixture.storage.exportSnapshot(snapshot.spaceId);check(after.storageSchemaVersion===1,'Fehlerfall verändert Version');
   const expected=scenario==='konkurrierender-Originalentwurf'?{...before,pending:before.pending.map((operation,index)=>index===0?{...operation,draft:{spaceId:snapshot.spaceId,note:'Konkurrierender Originalentwurf'}}:operation)}:before;
   check(equal(normalized(after),normalized(expected)),'Fehlerfall verliert Originaldaten/Entwürfe');
   const restarted=await fixture.restart();check(equal(normalized(await restarted.exportSnapshot(snapshot.spaceId)),normalized(expected)),'Rollback bleibt nach Neustart nicht erhalten');
   if(receipt!==undefined)check(equal(normalized(await protector.unseal(await fixture.backups.read(receipt))),normalized(before)),'Bestätigte Originalsicherung wurde entfernt');
  }
 }finally{await fixture.close();}
}

export async function runIndexMaintenanceCase(fixture:MigrationFixture):Promise<void>{
 try{
  const snapshot=p5Snapshot();await fixture.storage.replaceSnapshot(snapshot);
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  const coordinator=new LocalMigrationCoordinator(fixture.storage,snapshot.spaceId,[LOCAL_INDEX_MIGRATION],{protector,backups:fixture.backups,migration:fixture.migration,snapshotHash:migrationSnapshotHash});
  await coordinator.migrate(LOCAL_INDEX_MIGRATION_PLAN,{isCancelled:()=>false,onCancel:()=>()=>{}});
  const imported=await fixture.indices.queryImportedTransactions({spaceId:snapshot.spaceId,accountId:id(10),parserSource:'csv',externalId:'synthetische-externe-id',limit:100});check(equal(imported.map(row=>row.id),[id(17)]),'Externe Importquell-ID nicht indiziert');
  const original=snapshot.aggregates.find(row=>row.id===id(17))!;
  const changed={...original,revision:2,date:'2026-10-12',accountId:id(10),importReference:'geänderte-Quellreferenz'};
  await fixture.storage.applyAtomicBatch({expectedRevisions:[{handle:original.handle,expectedRevision:1}],aggregates:[changed],outbox:[],projections:[]});
  check((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'account',reference:id(11),limit:100})).length===0,'Alte Kontoindexzeile bleibt erhalten');
  check(equal((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'account',reference:id(10),fromDate:'2026-10-12',throughDate:'2026-10-12',limit:100})).map(row=>row.id),[id(17)]),'Konto-/Datumindex nach Änderung falsch');
  check((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'import',reference:'synthetische-quellreferenz',limit:100})).length===0,'Alter Importindex bleibt erhalten');
  check((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'category',reference:id(13),after:{date:'2026-10-12',handle:id(17)},limit:100})).length===0,'Pagination wiederholt Cursor');
  let conflict=false;try{await fixture.storage.applyAtomicBatch({expectedRevisions:[{handle:original.handle,expectedRevision:1}],aggregates:[original],outbox:[],projections:[]});}catch{conflict=true;}check(conflict,'CAS-Konflikt wurde gespeichert');
  check(equal((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'account',reference:id(10),limit:100})).map(row=>row.id),[id(17)]),'CAS-Fehler verliert Indexstand');
  await fixture.storage.applyAtomicBatch({expectedRevisions:[{handle:original.handle,expectedRevision:2}],aggregates:[{...changed,revision:3,deletedAt:'2026-10-09T10:00:00Z'}],outbox:[],projections:[]});
  for(const kind of ['account','category','import'] as const){check((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind,reference:kind==='account'?id(10):kind==='category'?id(13):'geänderte-Quellreferenz',limit:100})).length===0,'Tombstone bleibt als aktive Sekundärreferenz erhalten');}
  check((await fixture.indices.queryImportedTransactions({spaceId:snapshot.spaceId,accountId:id(10),parserSource:'csv',externalId:'synthetische-externe-id',limit:100})).length===0,'Importquelle liefert gelöschte Buchung');
  const currentVersion=(await fixture.storage.exportSnapshot(snapshot.spaceId)).storageSchemaVersion;
  await fixture.storage.replaceSnapshot({...snapshot,storageSchemaVersion:currentVersion});
  check(equal((await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'category',reference:id(13),limit:100})).map(row=>row.id),[id(17)]),'Snapshotersatz baut Referenzen nicht atomar auf');
  const outbox=snapshot.pending[0]!;
  await fixture.storage.applyAtomicBatch({expectedRevisions:[],aggregates:[],projections:[],outbox:[{...outbox,operationId:id(100),state:'queued',createdAt:'2026-10-09T12:00:00Z'},{...outbox,operationId:id(99),state:'queued',createdAt:'2026-10-09T11:00:00Z'},{...outbox,operationId:id(101),state:'sending',createdAt:'2026-10-09T10:00:00Z'}]});
  check(equal((await fixture.indices.queryIndexedPending({spaceId:snapshot.spaceId,state:'queued',limit:3})).map(row=>row.operationId),[id(70),id(99),id(100)]),'Outboxzustand/CreatedAt-Reihenfolge stimmt nicht');
  check((await fixture.indices.queryIndexedTransactions({spaceId:id(999),kind:'category',reference:id(13),limit:100})).length===0,'Indexabfrage verlässt Bereich');
 }finally{await fixture.close();}
}

import {rebuildStoredProjections} from '../../../packages/storage/src/projection-rebuild.js';
import type {TransactionAggregate} from '../../../packages/domain/src/index.js';
export async function runIndexPerformanceCase(fixture:MigrationFixture):Promise<{count:number;coldFirstPageMs:number;accountP95Ms:number;categoryP95Ms:number;importP95Ms:number}>{
 try{
  const initial=p5Snapshot(),template=initial.aggregates.find(row=>row.id===id(17))! as typeof initial.aggregates[number]&TransactionAggregate;
  const accounts=Array.from({length:8},(_,index)=>({...initial.aggregates.find(row=>row.id===id(10))!,id:id(200+index),handle:id(200+index)}));
  const categories=Array.from({length:99},(_,index)=>({...initial.aggregates.find(row=>row.id===id(13))!,id:id(300+index),handle:id(300+index)}));
  const accountIds=[id(10),id(11),...accounts.map(row=>row.id)],categoryIds=[id(13),...categories.map(row=>row.id)];
  const transactions=Array.from({length:49_999},(_,index)=>({...template,id:id(1_000_000+index),handle:id(1_000_000+index),accountId:accountIds[index%10]!,date:`${2024+Math.floor((index%36)/12)}-${String(index%12+1).padStart(2,'0')}-${String(index%28+1).padStart(2,'0')}`,scheduleOccurrenceId:undefined,importReference:`synthetische-quelle-${index%500}`,splits:[{id:id(2_000_000+index),categoryId:categoryIds[index%100]!,amount:template.amount}]}));
  const aggregates=[...initial.aggregates,...accounts,...categories,...transactions];
  const snapshot={...initial,aggregates,projections:rebuildStoredProjections(aggregates,initial.spaceId,initial.projections)};
  await fixture.storage.replaceSnapshot(snapshot);
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  await new LocalMigrationCoordinator(fixture.storage,snapshot.spaceId,[LOCAL_INDEX_MIGRATION],{protector,backups:fixture.backups,migration:fixture.migration,snapshotHash:migrationSnapshotHash}).migrate(LOCAL_INDEX_MIGRATION_PLAN,{isCancelled:()=>false,onCancel:()=>()=>{}});
  await fixture.restart();
  const cold=performance.now();const first=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'account',reference:id(10),limit:100});const coldFirstPageMs=performance.now()-cold;
  check(first.length===100,'Index liefert keine vollständige erste Seite');check(coldFirstPageMs<2000,'Kalte erste Indexseite überschreitet zwei Sekunden');
  const metrics:Record<string,number>={};
  for(const kind of ['account','category','import'] as const){
   const times:number[]=[];
   for(let sample=0;sample<30;sample++){
    const start=performance.now();const rows=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind,reference:kind==='account'?id(10):kind==='category'?id(13):'synthetische-quelle-0',limit:100});times.push(performance.now()-start);check(rows.length===100,'Warme Indexseite unvollständig');
   }
   times.sort((a,b)=>a-b);metrics[kind]=times[Math.ceil(times.length*.95)-1]!;check(metrics[kind]!<100,'Warme p95-Indexabfrage überschreitet 100 ms');
  }
  return {count:50_000,coldFirstPageMs,accountP95Ms:metrics.account!,categoryP95Ms:metrics.category!,importP95Ms:metrics.import!};
 }finally{await fixture.close();}
}

export async function runIndexProfileCase(fixture:MigrationFixture):Promise<void>{
 let other:(LocalStorageAdapter&{close?():Promise<void>})|undefined;
 try{
  const snapshot=p5Snapshot();await fixture.storage.replaceSnapshot(snapshot);
  const foreignProfile=id(998);other=fixture.forProfile(foreignProfile);
  const foreign={...snapshot,profileId:foreignProfile,syncState:{...snapshot.syncState!,profileId:foreignProfile},aggregates:snapshot.aggregates.map(row=>row.id===id(17)?{...row,note:'Synthetischer fremder Profilinhalt',date:'2026-10-08'}:row)};
  await other.replaceSnapshot(foreign);const before=await other.exportSnapshot(foreign.spaceId);await other.close?.();
  const protector=createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  await new LocalMigrationCoordinator(fixture.storage,snapshot.spaceId,[LOCAL_INDEX_MIGRATION],{protector,backups:fixture.backups,migration:fixture.migration,snapshotHash:migrationSnapshotHash}).migrate(LOCAL_INDEX_MIGRATION_PLAN,{isCancelled:()=>false,onCancel:()=>()=>{}});
  const own=await fixture.indices.queryIndexedTransactions({spaceId:snapshot.spaceId,kind:'category',reference:id(13),limit:100});
  check(own.length===1&&(own[0] as typeof snapshot.aggregates[number]&TransactionAggregate).date==='2026-10-09','Indexabfrage liefert fremden Profilbestand');
  other=fixture.forProfile(foreignProfile);const after=await other.exportSnapshot(foreign.spaceId);check(equal(normalized({...after,storageSchemaVersion:1}),normalized(before)),'Indexmigration verändert fremde Profildaten');
 }finally{await other?.close?.();await fixture.close();}
}
