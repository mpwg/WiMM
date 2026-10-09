// SPDX-License-Identifier: AGPL-3.0-or-later
import { Dexie, type Table, type Transaction } from 'dexie';
import {uuidSchema,base64UrlSchema,type AtomicBatch,type RevisionExpectation,type CancellationPort,type LocalMigrationPort} from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';
import { rebuildStoredProjections } from './projection-rebuild.js';
import { validateLocalSnapshot } from './snapshot-validation.js';
import { checkLocalMigration, equalMigrationSnapshot, type LocalMigrationInput, type MigrationBackupVerification } from './local-migrations.js';
import { transactionIndexRows, importSourceIndexRows, pendingCreatedAt, type TransactionIndexRow,type ImportSourceIndexRow } from './local-indexes.js';
import { validateTransactionIndexQuery, validatePendingIndexQuery, validateImportSourceQuery,type ImportSourceQuery,type TransactionIndexQuery, type PendingIndexQuery, type LocalIndexQueryPort } from './index-queries.js';

import {
  assertExpectedRevision,
  type ConfirmedAggregate,
  type LocalSnapshot,
  type LocalStorageAdapter,
  type PendingOperation,
  type StoredAggregate,
  type StoredProjection,
  type SyncPage,
  type SyncState,
  StorageWriteError
} from './contracts.js';

interface AggregateRow { profileId: UUID; handle: UUID; spaceId: UUID; payload: StoredAggregate; }
interface ConfirmedRow { profileId: UUID; handle: UUID; spaceId: UUID; payload: ConfirmedAggregate; }
interface PendingRow { profileId: UUID; operationId: UUID; spaceId: UUID; createdAt?: string; payload: PendingOperation; }
interface ProjectionRow { profileId: UUID; spaceId: UUID; kind: string; key: string; payload: StoredProjection; }
const SCHEMA_KEY = 'wimm:storage-schema';
interface SyncRow { profileId: string; spaceId: string; payload?: SyncState; localEpoch?: UUID; versions?: { storageSchemaVersion: number; domainSchemaVersion: number }; migrationNumber?: number; migration?: { backupId: UUID; snapshotHash: string; profileId: UUID; spaceId: UUID; epoch: UUID } }
interface MigrationUpgrade { input: LocalMigrationInput; cancellation: CancellationPort; applied?: boolean }

class WimmDexie extends Dexie {
  aggregates!: Table<AggregateRow, [UUID, UUID]>;
  confirmed!: Table<ConfirmedRow, [UUID, UUID]>;
  pending!: Table<PendingRow, [UUID, UUID]>;
  projections!: Table<ProjectionRow, [UUID, UUID, string, string]>;
  syncStates!: Table<SyncRow, [string, string]>;
  transactionIndexes!: Table<TransactionIndexRow,[UUID,UUID,string,string]>;
  importSourceIndexes!:Table<ImportSourceIndexRow,[UUID,UUID]>;

  constructor(name: string, version: 1|2 = 1, upgrade?: MigrationUpgrade) {
    super(name);
    this.on('versionchange',()=>{this.close();return false;});
    this.version(1).stores({
      aggregates: '[profileId+handle], [profileId+spaceId]',
      confirmed: '[profileId+handle], [profileId+spaceId]',
      pending: '[profileId+operationId], [profileId+spaceId], [profileId+spaceId+payload.state]',
      projections: '[profileId+spaceId+kind+key], [profileId+spaceId]',
      syncStates: '[profileId+spaceId]'
    });
    if (version === 2) this.version(2).stores({
      aggregates:'[profileId+handle], [profileId+spaceId], [profileId+spaceId+payload.aggregateType+payload.order+handle], [profileId+spaceId+payload.aggregateType+payload.scheduleId+payload.dueDate+handle]',
      pending: '[profileId+operationId], [profileId+spaceId], [profileId+spaceId+payload.state], [profileId+spaceId+payload.state+createdAt+operationId]',
      transactionIndexes: '[profileId+handle+kind+reference], [profileId+handle], [profileId+spaceId], [profileId+spaceId+kind+reference+date+handle]',
      importSourceIndexes:'[profileId+handle], [profileId+spaceId], [profileId+spaceId+accountId+parserSource+externalId]'
    }).upgrade(async tx=>{
      if (upgrade === undefined) throw new StorageWriteError('Eine bestehende Datenbank benötigt eine bestätigte Migration.');
      const {input,cancellation} = upgrade;
      const backup = checkLocalMigration(input,cancellation);
      const marker = await tx.table<SyncRow>('syncStates').get([SCHEMA_KEY,SCHEMA_KEY]);
      if (marker !== undefined && (marker.versions?.storageSchemaVersion !== 1 || marker.versions.domainSchemaVersion !== 1 || (marker.migrationNumber ?? 0) !== 0)) throw new StorageWriteError('Der Migrationsjournalstand ist nicht mehr aktuell.');
      const actual = await snapshotFromTransaction(tx,input.expectedSnapshot.profileId,input.expectedSnapshot.spaceId);
      if (!equalMigrationSnapshot(actual,input.expectedSnapshot)) throw new StorageWriteError('Der Ausgangsstand der Migration ist nicht mehr aktuell.');
      const aggregates = await tx.table<AggregateRow>('aggregates').toArray();
      await tx.table<TransactionIndexRow>('transactionIndexes').bulkAdd(aggregates.flatMap(row=>transactionIndexRows(row.profileId,row.payload)));
      await tx.table<ImportSourceIndexRow>('importSourceIndexes').bulkAdd(aggregates.flatMap(row=>importSourceIndexRows(row.profileId,row.payload)));
      const pending = await tx.table<PendingRow>('pending').toArray();
      await tx.table<PendingRow>('pending').bulkPut(pending.map(row=>({...row,createdAt:pendingCreatedAt(row.payload)})));
      checkLocalMigration(input,cancellation);
      upgrade.applied=true;
      await tx.table<SyncRow>('syncStates').put({profileId:SCHEMA_KEY,spaceId:SCHEMA_KEY,versions:{storageSchemaVersion:2,domainSchemaVersion:1},migrationNumber:1,migration:{backupId:backup.backupId,snapshotHash:backup.snapshotHash,profileId:backup.profileId,spaceId:backup.spaceId,epoch:backup.epoch}});
      checkLocalMigration(input,cancellation);
    });
  }
}

/** Dexie-Adapter mit denselben atomaren Grenzen wie die Desktop-Implementierung. */
export class IndexedDbStorageAdapter implements LocalStorageAdapter, LocalMigrationPort<LocalSnapshot>, LocalIndexQueryPort {
  readonly profileId: UUID;
  private db!: WimmDexie;
  private ready: Promise<void>;

  constructor(profileId: UUID, private readonly databaseName = `wimm-${profileId}`, private readonly backups?: MigrationBackupVerification) {
    this.profileId = profileId;
    this.ready = this.openCurrent();
  }

  private async openCurrent(): Promise<void> {
    const physical = await new Promise<number>((resolve,reject)=>{
      const request = indexedDB.open(this.databaseName);
      request.onerror=()=>reject(new StorageWriteError('Die Speicherdatenbank kann nicht geöffnet werden.'));
      request.onblocked=()=>reject(new StorageWriteError('Die Speicherdatenbank ist durch einen anderen Client blockiert.'));
      request.onsuccess=()=>{const version=request.result.version;request.result.close();resolve(version);};
    });
    if (![1,10,20].includes(physical)) throw new StorageWriteError('Die Speicherversion wird nicht unterstützt.');
    this.db = new WimmDexie(this.databaseName,physical===20?2:1);
    await this.db.open();
  }

  async migrate(input: LocalMigrationInput,cancellation: CancellationPort): Promise<void> {
    const receipt = checkLocalMigration(input,cancellation);
    if (input.expectedSnapshot.profileId !== this.profileId || this.backups === undefined) throw new StorageWriteError('Die gespeicherte Sicherung kann nicht überprüft werden.');
    await this.ready;
    if(this.db.verno!==1) throw new StorageWriteError('Der Migrationsjournalstand ist nicht mehr aktuell.');
    validateLocalSnapshot(input.expectedSnapshot,this.profileId);
    await this.backups.verify(receipt,input.expectedSnapshot);
    checkLocalMigration(input,cancellation);
    this.db.close();
    const context:MigrationUpgrade={input,cancellation};
    const upgraded = new WimmDexie(this.databaseName,2,context);
    try { await upgraded.open(); if(context.applied!==true) throw new StorageWriteError('Der Migrationsjournalstand ist nicht mehr aktuell.'); this.db=upgraded; }
    catch(error) { upgraded.close(); this.ready=this.openCurrent(); await this.ready; throw error; }
  }

  async initializeArea(spaceId: UUID, proposedEpoch: UUID): Promise<UUID> {
    return this.checked('rw', async () => this.db.transaction('rw', this.db.syncStates, this.db.confirmed, async () => {
      const row = await this.db.syncStates.get([this.profileId, spaceId]);
      const confirmed = await this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, spaceId]).first();
      const epoch = row?.localEpoch ?? row?.payload?.epoch ?? confirmed?.payload.epoch ?? proposedEpoch;
      await this.db.syncStates.put({ ...row, profileId: this.profileId, spaceId, localEpoch: epoch });
      return epoch;
    }));
  }

  async readAggregate(handle: UUID): Promise<StoredAggregate | undefined> {
    return this.checked('r', async () => (await this.db.aggregates.get([this.profileId, handle]))?.payload);
  }

  async query(query: { readonly spaceId: UUID }): Promise<readonly StoredAggregate[]> {
    return this.checked('r', async () => (await this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, query.spaceId]).toArray()).map((entry) => entry.payload));
  }

  async queryIndexedTransactions(query:TransactionIndexQuery):Promise<readonly StoredAggregate[]>{
    validateTransactionIndexQuery(query);
    return this.checked('r',async()=>{
      if(this.db.verno!==2)throw new StorageWriteError('Die Indexabfrage benötigt die gesicherte Migration.');
      if(query.after!==undefined&&query.throughDate!==undefined&&query.after.date>query.throughDate)return [];
      const afterAllowed=query.after!==undefined && (query.fromDate===undefined||query.after.date>=query.fromDate);
      const lower=[this.profileId,query.spaceId,query.kind,query.reference,afterAllowed?query.after!.date:query.fromDate??'',afterAllowed?query.after!.handle:''];
      const upper=[this.profileId,query.spaceId,query.kind,query.reference,query.throughDate??'9999-12-31','\uffff'];
      const rows=await this.db.transactionIndexes.where('[profileId+spaceId+kind+reference+date+handle]').between(lower,upper,!afterAllowed,true).limit(query.limit).toArray();
      const aggregates=await this.db.aggregates.bulkGet(rows.map(row=>[this.profileId,row.handle] as [UUID,UUID]));
      return aggregates.filter((row):row is AggregateRow=>row!==undefined).map(row=>row.payload);
    });
  }
  async queryIndexedPending(query:PendingIndexQuery):Promise<readonly PendingOperation[]>{
    validatePendingIndexQuery(query);
    return this.checked('r',async()=>{
      if(this.db.verno!==2)throw new StorageWriteError('Die Indexabfrage benötigt die gesicherte Migration.');
      return (await this.db.pending.where('[profileId+spaceId+payload.state+createdAt+operationId]').between([this.profileId,query.spaceId,query.state,'',''],[this.profileId,query.spaceId,query.state,'\uffff','\uffff'],true,true).limit(query.limit).toArray()).map(row=>row.payload);
    });
  }
  async queryImportedTransactions(query:ImportSourceQuery):Promise<readonly StoredAggregate[]>{
    validateImportSourceQuery(query);
    return this.checked('r',async()=>{
      if(this.db.verno!==2)throw new StorageWriteError('Die Indexabfrage benötigt die gesicherte Migration.');
      const rows=await this.db.importSourceIndexes.where('[profileId+spaceId+accountId+parserSource+externalId]').equals([this.profileId,query.spaceId,query.accountId,query.parserSource,query.externalId]).toArray();
      const targets=await this.db.aggregates.bulkGet([...new Set(rows.map(row=>row.transactionId))].map(handle=>[this.profileId,handle] as [UUID,UUID]));
      return targets.filter((row):row is AggregateRow=>row!==undefined&&row.spaceId===query.spaceId&&row.payload.aggregateType==='transaction'&&row.payload.deletedAt===undefined).map(row=>row.payload).toSorted((a,b)=>{
        const dateA=(a as StoredAggregate&{date:string}).date,dateB=(b as StoredAggregate&{date:string}).date;
        return dateA<dateB?-1:dateA>dateB?1:a.handle<b.handle?-1:a.handle>b.handle?1:0;
      }).slice(0,query.limit);
    });
  }

  async applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void> {
    await this.write(async () => this.db.transaction(
      'rw', this.db.tables,
      async () => {
        await assertBatch(this.db, this.profileId, batch.expectedRevisions);
        await this.db.aggregates.bulkPut(batch.aggregates.map((payload) => ({ profileId: this.profileId, handle: payload.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkPut(batch.outbox.map((payload) => ({ profileId: this.profileId, operationId: payload.operationId, spaceId: payload.spaceId, createdAt:pendingCreatedAt(payload), payload })));
        if (this.db.verno===2) for(const aggregate of batch.aggregates){await this.db.transactionIndexes.where('[profileId+handle]').equals([this.profileId,aggregate.handle]).delete();await this.db.transactionIndexes.bulkPut(transactionIndexRows(this.profileId,aggregate));}
        if (this.db.verno===2) for(const aggregate of batch.aggregates){await this.db.importSourceIndexes.delete([this.profileId,aggregate.handle]);await this.db.importSourceIndexes.bulkPut(importSourceIndexRows(this.profileId,aggregate));}
        await this.db.projections.bulkPut(batch.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
      }
    ));
  }

  async loadConfirmed(spaceId: UUID): Promise<readonly ConfirmedAggregate[]> {
    return this.checked('r', async () => (await this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()).map((entry) => entry.payload));
  }

  async loadPending(spaceId: UUID): Promise<readonly PendingOperation[]> {
    return this.checked('r', async () => (await this.db.pending.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()).map((entry) => entry.payload));
  }

  async saveSyncPage(page: SyncPage): Promise<void> {
    if (page.state.profileId !== this.profileId) throw new StorageWriteError('Das Profil der Syncseite passt nicht.');
    await this.write(async () => this.db.transaction(
      'rw', this.db.confirmed, this.db.pending, this.db.projections, this.db.syncStates,
      async () => {
        await this.db.confirmed.bulkPut(page.confirmed.map((payload) => ({ profileId: this.profileId, handle: payload.aggregate.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkDelete(page.removeOperationIds.map((id) => [this.profileId, id] as [UUID, UUID]));
        await this.db.projections.bulkPut(page.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
        await this.db.syncStates.put({ profileId: this.profileId, spaceId: page.state.spaceId, payload: page.state, localEpoch: page.state.epoch });
      }
    ));
  }

  async getSyncState(spaceId: UUID): Promise<SyncState | undefined> {
    return this.checked('r', async () => (await this.db.syncStates.get([this.profileId, spaceId]))?.payload);
  }

  async exportSnapshot(spaceId: UUID): Promise<LocalSnapshot> {
    return this.checked('r', async () => {
      const [row, aggregates, confirmed, pending, projections] = await Promise.all([
        this.db.syncStates.get([this.profileId, spaceId]),
        this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray(),
        this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray(),
        this.db.pending.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray(),
        this.db.projections.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray()
      ]);
      const epoch = row?.payload?.epoch ?? row?.localEpoch ?? confirmed[0]?.payload.epoch;
      if (epoch === undefined) throw new StorageWriteError('Für den Bereich fehlt eine Epoche.');
      return { storageSchemaVersion: this.db.verno, domainSchemaVersion: 1, profileId: this.profileId, spaceId, epoch,
        aggregates: aggregates.map((entry) => entry.payload), confirmed: confirmed.map((entry) => entry.payload),
        pending: pending.map((entry) => entry.payload), projections: projections.map((entry) => entry.payload), syncState: row?.payload };
    });
  }

  async replaceSnapshot(snapshot: LocalSnapshot): Promise<void> {
    snapshot = validateLocalSnapshot(snapshot, this.profileId);
    await this.write(async () => this.db.transaction(
      'rw', this.db.tables,
      async () => {
        for (const aggregate of snapshot.aggregates) {
          const current = await this.db.aggregates.get([this.profileId, aggregate.handle]);
          if (current !== undefined && current.spaceId !== snapshot.spaceId) throw new StorageWriteError('Ein Snapshothandle gehört zu einem anderen Bereich.');
        }
        for (const confirmed of snapshot.confirmed) {
          const current = await this.db.confirmed.get([this.profileId, confirmed.aggregate.handle]);
          if (current !== undefined && current.spaceId !== snapshot.spaceId) throw new StorageWriteError('Ein bestätigtes Snapshothandle gehört zu einem anderen Bereich.');
        }
        for (const operation of snapshot.pending) {
          const current = await this.db.pending.get([this.profileId, operation.operationId]);
          if (current !== undefined && current.spaceId !== snapshot.spaceId) throw new StorageWriteError('Eine Snapshotoperation gehört zu einem anderen Bereich.');
        }
        await this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.confirmed.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.pending.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        if(this.db.verno===2) await this.db.transactionIndexes.where('[profileId+spaceId]').equals([this.profileId,snapshot.spaceId]).delete();
        if(this.db.verno===2) await this.db.importSourceIndexes.where('[profileId+spaceId]').equals([this.profileId,snapshot.spaceId]).delete();
        await this.db.projections.where('[profileId+spaceId]').equals([this.profileId, snapshot.spaceId]).delete();
        await this.db.syncStates.delete([this.profileId, snapshot.spaceId]);
        await this.db.aggregates.bulkPut(snapshot.aggregates.map((payload) => ({ profileId: this.profileId, handle: payload.handle, spaceId: payload.spaceId, payload })));
        await this.db.confirmed.bulkPut(snapshot.confirmed.map((payload) => ({ profileId: this.profileId, handle: payload.aggregate.handle, spaceId: payload.spaceId, payload })));
        await this.db.pending.bulkPut(snapshot.pending.map((payload) => ({ profileId: this.profileId, operationId: payload.operationId, spaceId: payload.spaceId, createdAt:pendingCreatedAt(payload), payload })));
        if(this.db.verno===2) await this.db.transactionIndexes.bulkPut(snapshot.aggregates.flatMap(aggregate=>transactionIndexRows(this.profileId,aggregate)));
        if(this.db.verno===2) await this.db.importSourceIndexes.bulkPut(snapshot.aggregates.flatMap(aggregate=>importSourceIndexRows(this.profileId,aggregate)));
        await this.db.projections.bulkPut(snapshot.projections.map((payload) => ({ profileId: this.profileId, spaceId: payload.spaceId, kind: payload.kind, key: payload.key, payload })));
        await this.db.syncStates.put({ profileId: this.profileId, spaceId: snapshot.spaceId, ...(snapshot.syncState === undefined ? {} : { payload: snapshot.syncState }), localEpoch: snapshot.epoch });
      }
    ));
  }

  async rebuildProjections(spaceId: UUID): Promise<void> {
    await this.write(async () => this.db.transaction('rw', this.db.aggregates, this.db.projections, async () => {
      const source = await this.db.aggregates.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray();
      const previous = await this.db.projections.where('[profileId+spaceId]').equals([this.profileId, spaceId]).toArray();
      const rebuilt = rebuildStoredProjections(source.map((entry) => entry.payload), spaceId, previous.map((entry) => entry.payload));
      await this.db.projections.where('[profileId+spaceId]').equals([this.profileId, spaceId]).delete();
      await this.db.projections.bulkPut(rebuilt.map((payload) => ({ profileId: this.profileId, spaceId, kind: payload.kind, key: payload.key, payload })));
    }));
  }

  async close(): Promise<void> { await this.ready; this.db.close(); }

  private async checked<T>(mode: 'r' | 'rw', operation: () => Promise<T>): Promise<T> {
    await this.ready;
    return this.db.transaction(mode, this.db.tables, async () => {
      const row = await this.db.syncStates.get([SCHEMA_KEY, SCHEMA_KEY]);
      if (row===undefined && this.db.verno===2) throw new StorageWriteError('Der Migrationsjournalstand fehlt.');
      if(this.db.verno===2&&(row?.migration===undefined||![row.migration.backupId,row.migration.profileId,row.migration.spaceId,row.migration.epoch].every(value=>uuidSchema.safeParse(value).success)||!base64UrlSchema.safeParse(row.migration.snapshotHash).success))throw new StorageWriteError('Der Migrationsjournalstand ist nicht gültig.');
      if (row !== undefined && (row.versions?.storageSchemaVersion !== this.db.verno || row.versions.domainSchemaVersion !== 1 || this.db.verno===2 && row.migrationNumber!==1)) {
        throw new StorageWriteError('Die Storage- oder Fachversion wird nicht unterstützt. Bitte eine passende Appversion verwenden; der vorhandene Stand bleibt erhalten.');
      }
      // Additive V1-Metadaten; kein Reset, keine neue Dexie-Version und keine Finanzmigration.
      if (row === undefined && mode === 'rw') await this.db.syncStates.add({ profileId: SCHEMA_KEY, spaceId: SCHEMA_KEY, versions: { storageSchemaVersion: 1, domainSchemaVersion: 1 } });
      return operation();
    });
  }

  private async write(operation: () => Promise<unknown>): Promise<void> {
    try { await this.checked('rw', operation); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageWriteError('Der Browserspeicher ist voll. Eingaben bleiben erhalten.', 'QUOTA');
      }
      throw error;
    }
  }
}

async function assertBatch(db: WimmDexie, profileId: UUID, expected: readonly RevisionExpectation[]): Promise<void> {
  for (const entry of expected) assertExpectedRevision((await db.aggregates.get([profileId, entry.handle]))?.payload, entry.expectedRevision);
}

/** Fragt dauerhafte Browserpersistenz an; die Oberfläche kann Ablehnung sichtbar erklären. */
export async function requestPersistentBrowserStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) return false;
  return navigator.storage.persist();
}

async function snapshotFromTransaction(tx:Transaction,profileId:UUID,spaceId:UUID):Promise<LocalSnapshot>{
  const [row,marker,aggregates,confirmed,pending,projections]=await Promise.all([
    tx.table<SyncRow>('syncStates').get([profileId,spaceId]),
    tx.table<SyncRow>('syncStates').get([SCHEMA_KEY,SCHEMA_KEY]),
    tx.table<AggregateRow>('aggregates').where('[profileId+spaceId]').equals([profileId,spaceId]).toArray(),
    tx.table<ConfirmedRow>('confirmed').where('[profileId+spaceId]').equals([profileId,spaceId]).toArray(),
    tx.table<PendingRow>('pending').where('[profileId+spaceId]').equals([profileId,spaceId]).toArray(),
    tx.table<ProjectionRow>('projections').where('[profileId+spaceId]').equals([profileId,spaceId]).toArray()
  ]);
  const epoch=row?.payload?.epoch??row?.localEpoch??confirmed[0]?.payload.epoch;
  if(epoch===undefined)throw new StorageWriteError('Für den Bereich fehlt eine Epoche.');
  return {storageSchemaVersion:marker?.versions?.storageSchemaVersion??1,domainSchemaVersion:marker?.versions?.domainSchemaVersion??1,profileId,spaceId,epoch,aggregates:aggregates.map(row=>row.payload),confirmed:confirmed.map(row=>row.payload),pending:pending.map(row=>row.payload),projections:projections.map(row=>row.payload),syncState:row?.payload};
}
