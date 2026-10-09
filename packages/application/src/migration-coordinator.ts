// SPDX-License-Identifier: AGPL-3.0-or-later
import { storageMigrationPlanSchema,uuidSchema,base64UrlSchema,type Base64Url,type CancellationPort,type EncryptedBackupPort,type EncryptedBackupReceipt,type LocalMigrationPort,type StorageMigrationPlan,type UUID } from '@wimm/contracts';
import {StorageWriteError,type LocalSnapshot,type LocalStorageAdapter} from '@wimm/storage';
import {validateLocalSnapshot} from '@wimm/storage';
import type {SnapshotProtector} from '@wimm/storage';
export type RegisteredMigrationStep=StorageMigrationPlan['steps'][number];
export interface MigrationPreparationPorts {
 readonly protector:SnapshotProtector;
 readonly backups:EncryptedBackupPort;
 readonly migration:LocalMigrationPort<LocalSnapshot>;
 readonly snapshotHash:(snapshot:LocalSnapshot)=>Promise<Base64Url>;
}
function cancelled(cancellation:CancellationPort){if(cancellation.isCancelled())throw new StorageWriteError('Die Migration wurde abgebrochen. Der Originalbestand bleibt erhalten.');}
/** Sicherungsvorbereitung außerhalb von DB-Transaktionen; der Adapter vergleicht den Ausgangsstand atomar. */
export class LocalMigrationCoordinator {
 constructor(private readonly storage:Pick<LocalStorageAdapter,'profileId'|'exportSnapshot'>,private readonly spaceId:UUID,private readonly registry:readonly RegisteredMigrationStep[],private readonly ports:MigrationPreparationPorts){}
 async migrate(input:StorageMigrationPlan,cancellation:CancellationPort):Promise<EncryptedBackupReceipt|undefined>{
  const parsed=storageMigrationPlanSchema.safeParse(input);
  if(!parsed.success)throw new StorageWriteError('Der Migrationsplan ist nicht unterstützt oder vorwärtsgerichtet.');
  const plan=parsed.data;
  for(const step of plan.steps){const registered=this.registry.find(r=>r.number===step.number);if(!registered||registered.from.storageSchemaVersion!==step.from.storageSchemaVersion||registered.from.domainSchemaVersion!==step.from.domainSchemaVersion||registered.to.storageSchemaVersion!==step.to.storageSchemaVersion||registered.to.domainSchemaVersion!==step.to.domainSchemaVersion||registered.destructive!==step.destructive)throw new StorageWriteError('Die angeforderte Migration ist nicht registriert.');}
  cancelled(cancellation);
  const snapshot=validateLocalSnapshot(await this.storage.exportSnapshot(this.spaceId),this.storage.profileId);
  if(snapshot.spaceId!==this.spaceId||snapshot.storageSchemaVersion!==plan.from.storageSchemaVersion||snapshot.domainSchemaVersion!==plan.from.domainSchemaVersion)throw new StorageWriteError('Der Migrationsplan passt nicht zum aktuellen Ausgangsstand.');
  cancelled(cancellation);
  let receipt:EncryptedBackupReceipt|undefined;
  // Auch der erste additive Indexausbau benötigt einen belegten Originalsnapshot.
  {
   const snapshotHash=await this.ports.snapshotHash(snapshot);if(!base64UrlSchema.safeParse(snapshotHash).success)throw new StorageWriteError('Die Sicherungsbasis kann nicht überprüft werden.');cancelled(cancellation);
   const ciphertext=await this.ports.protector.seal(snapshot);cancelled(cancellation);
   if(!(ciphertext instanceof Uint8Array)||ciphertext.byteLength===0)throw new StorageWriteError('Die verschlüsselte Sicherung ist nicht verfügbar.');
   receipt=await this.ports.backups.persist({profileId:snapshot.profileId,spaceId:snapshot.spaceId,epoch:snapshot.epoch,snapshotHash,ciphertext});
   if(!uuidSchema.safeParse(receipt.backupId).success||receipt.profileId!==snapshot.profileId||receipt.spaceId!==snapshot.spaceId||receipt.epoch!==snapshot.epoch||receipt.snapshotHash!==snapshotHash)throw new StorageWriteError('Die dauerhaft bestätigte Sicherung passt nicht zum Ausgangsstand.');
  }
  cancelled(cancellation);
  await this.ports.migration.migrate({plan,expectedSnapshot:snapshot,backup:receipt},cancellation);
  return receipt;
 }
}
