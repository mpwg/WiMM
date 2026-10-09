// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Base64Url, EncryptedBackupReceipt } from '@wimm/contracts';
import { equalMigrationSnapshot, validateLocalSnapshot, StorageWriteError, type LocalSnapshot, type MigrationBackupVerification, type SnapshotProtector } from '@wimm/storage';

/** Echte gespeicherte Sicherung außerhalb der Finanztransaktion authentifizieren und an die Basis binden. */
export function createMigrationBackupVerifier(backups:{read(receipt:EncryptedBackupReceipt):Promise<Uint8Array>}, protector:SnapshotProtector, snapshotHash:(snapshot:LocalSnapshot)=>Promise<Base64Url>):MigrationBackupVerification{
 return {async verify(receipt,snapshot){
  if(receipt.profileId!==snapshot.profileId||receipt.spaceId!==snapshot.spaceId||receipt.epoch!==snapshot.epoch||receipt.snapshotHash!==await snapshotHash(snapshot))throw new StorageWriteError('Die Sicherungsbasis passt nicht zum Ausgangsstand.');
  const restored=validateLocalSnapshot(await protector.unseal(await backups.read(receipt)),snapshot.profileId);
  if(!equalMigrationSnapshot(restored,snapshot))throw new StorageWriteError('Die gespeicherte Sicherung enthält einen anderen Ausgangsstand.');
 }};
}
