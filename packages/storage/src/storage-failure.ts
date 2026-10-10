// SPDX-License-Identifier: AGPL-3.0-or-later
import { Dexie } from 'dexie';
import type { StorageFailure, StorageFailureCode, FailureCommitState } from '../../contracts/generated/local-v2/wasm/wimm_local_contracts.js';
export type { StorageFailure, StorageFailureCode, FailureCommitState };
const messages: Record<StorageFailureCode, string> = {
  REVISION_CONFLICT: 'Die lokale Revision ist nicht mehr aktuell.',
  QUOTA: 'Der lokale Speicher ist voll. Eingaben bleiben erhalten.',
  RESOURCE_UNAVAILABLE: 'Der lokale Speicher ist momentan nicht verfügbar.',
  WRITE_FAILED: 'Die Eingaben konnten nicht gespeichert werden.',
  UPDATE_REQUIRED: 'Die Speicherversion benötigt eine passende Appversion.',
  EPOCH_MISMATCH: 'Die Bestätigungsepoche passt nicht zum lokalen Stand.',
  CANCELLED: 'Der Vorgang wurde abgebrochen. Eingaben bleiben erhalten.',
  COMMIT_UNKNOWN: 'Der Speicherabschluss ist unklar. Bitte den Stand prüfen, bevor erneut gespeichert wird.',
  INVALID_RESPONSE: 'Die Speicherantwort ist nicht unterstützt. Bitte den Stand prüfen, bevor erneut gespeichert wird.',
  OPERATION_ID_REUSED: 'Die Operationskennung wurde für andere Eingaben verwendet.'
};
export class StorageFailureError extends Error {
  readonly causeCode: StorageFailureCode;
  constructor(readonly code: StorageFailureCode, readonly commitState: FailureCommitState = 'notCommitted') {
    super(messages[code]); this.name = 'StorageFailureError'; this.causeCode = code;
  }
}
/** Fremde Texte und Zusatzdaten werden nie übernommen oder als Erfolg gewertet. */
export function decodeStorageFailure(input: unknown): StorageFailureError {
  try {
  if (input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
    const value = input as Record<string, unknown>;
    if (Reflect.ownKeys(value).length === 3 && Object.values(Object.getOwnPropertyDescriptors(value)).every(entry => 'value' in entry) && value.contractVersion === 2 && typeof value.code === 'string' && Object.hasOwn(messages, value.code) && (value.commitState === 'unknown' || value.commitState === 'notCommitted') && (value.code !== 'COMMIT_UNKNOWN' || value.commitState === 'unknown')) {
      return new StorageFailureError(value.code as StorageFailureCode, value.commitState);
    }
  }
  } catch { /* Auch Proxies/Getter liefern nur einen sicheren lokalen Fehler. */ }
  return new StorageFailureError('INVALID_RESPONSE', 'unknown');
}
export function normalizeStorageWriteFailure(input: unknown): StorageFailureError {
  if (input instanceof StorageFailureError) return input;
  if (input instanceof Dexie.DataError) return new StorageFailureError('WRITE_FAILED');
  if (input instanceof Dexie.QuotaExceededError) return new StorageFailureError('QUOTA');
  if (input instanceof Dexie.AbortError) return new StorageFailureError('CANCELLED');
  if (input instanceof Dexie.VersionError) return new StorageFailureError('UPDATE_REQUIRED');
  if (input instanceof Dexie.InvalidStateError || input instanceof Dexie.DatabaseClosedError) return new StorageFailureError('RESOURCE_UNAVAILABLE');
  if (input instanceof DOMException) {
    if (input.name === 'DataError') return new StorageFailureError('WRITE_FAILED');
    if (input.name === 'QuotaExceededError') return new StorageFailureError('QUOTA');
    if (input.name === 'AbortError') return new StorageFailureError('CANCELLED');
    if (input.name === 'InvalidStateError' || input.name === 'NotReadableError') return new StorageFailureError('RESOURCE_UNAVAILABLE');
  }
  return new StorageFailureError('WRITE_FAILED', 'unknown');
}
