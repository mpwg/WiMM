// SPDX-License-Identifier: AGPL-3.0-or-later
import { storageMigrationPlanSchema, type StorageMigrationPlan, type CancellationPort, type EncryptedBackupReceipt, type LocalMigrationPort } from '@wimm/contracts';
import { StorageWriteError, type LocalSnapshot } from './contracts.js';

export const LOCAL_INDEX_MIGRATION = { number: 1, from: { storageSchemaVersion: 1, domainSchemaVersion: 1 }, to: { storageSchemaVersion: 2, domainSchemaVersion: 1 }, destructive: false } as const;
export const LOCAL_INDEX_MIGRATION_PLAN: StorageMigrationPlan = { expectedMigrationNumber: 0, from: LOCAL_INDEX_MIGRATION.from, steps: [LOCAL_INDEX_MIGRATION] };
export type LocalMigrationInput = Parameters<LocalMigrationPort<LocalSnapshot>['migrate']>[0];
export interface MigrationBackupVerification {
  /** Außerhalb jeder Finanztransaktion: gespeicherte Hülle und tatsächlichen Snapshot-Hash überprüfen. */
  verify(receipt: EncryptedBackupReceipt, snapshot: LocalSnapshot): Promise<void>;
}
export function checkLocalMigration(input: LocalMigrationInput, cancellation: CancellationPort): EncryptedBackupReceipt {
  if (cancellation.isCancelled()) throw new StorageWriteError('Die Migration wurde abgebrochen. Der Originalbestand bleibt erhalten.');
  const parsed = storageMigrationPlanSchema.safeParse(input.plan);
  if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(LOCAL_INDEX_MIGRATION_PLAN)) throw new StorageWriteError('Die angeforderte Migration ist nicht registriert.');
  const { backup, expectedSnapshot } = input;
  if (backup === undefined || backup.profileId !== expectedSnapshot.profileId || backup.spaceId !== expectedSnapshot.spaceId || backup.epoch !== expectedSnapshot.epoch || expectedSnapshot.storageSchemaVersion !== 1 || expectedSnapshot.domainSchemaVersion !== 1) throw new StorageWriteError('Die bestätigte Sicherung passt nicht zum Ausgangsstand.');
  return backup;
}

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).filter(([,entry])=>entry !== undefined).sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0).map(([key,entry])=>[key,ordered(entry)]));
  return value;
}
/** Vollständiger CAS, kein Hashersatz: alle gespeicherten Felder einschließlich Entwürfen vergleichen. */
export function equalMigrationSnapshot(a: LocalSnapshot, b: LocalSnapshot): boolean { return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b)); }
