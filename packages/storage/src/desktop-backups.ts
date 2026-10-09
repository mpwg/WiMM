// SPDX-License-Identifier: AGPL-3.0-or-later
import { base64UrlSchema, uuidSchema, type EncryptedBackupPort, type EncryptedBackupReceipt, type IdSourcePort } from '@wimm/contracts';

export type DesktopBackupCommand = 'storage_persist_encrypted_backup' | 'storage_read_encrypted_backup';
type Invoke = <T>(command: DesktopBackupCommand, arguments_: Record<string, unknown>) => Promise<T>;
const failure = 'Die verschlüsselte Sicherung wurde nicht dauerhaft bestätigt.';

function validReceipt(receipt: EncryptedBackupReceipt): boolean {
  return [receipt.backupId, receipt.profileId, receipt.spaceId, receipt.epoch].every(value => uuidSchema.safeParse(value).success)
    && base64UrlSchema.safeParse(receipt.snapshotHash).success;
}

/** Rust bestätigt FULL-Commit und Rücklesen; dieser Port prüft zusätzlich die IPC-Rückgabe. */
export class DesktopEncryptedBackupPort implements EncryptedBackupPort {
  constructor(private readonly ids: IdSourcePort, private readonly invoke: Invoke) {}

  async persist(input: Parameters<EncryptedBackupPort['persist']>[0]): Promise<EncryptedBackupReceipt> {
    const receipt: EncryptedBackupReceipt = { backupId: this.ids.next(), profileId: input.profileId, spaceId: input.spaceId, epoch: input.epoch, snapshotHash: input.snapshotHash };
    if (!validReceipt(receipt) || !(input.ciphertext instanceof Uint8Array) || input.ciphertext.length === 0) throw new Error('Die Sicherungshülle ist nicht gültig.');
    const ciphertext = input.ciphertext.slice();
    const stored = await this.invoke<EncryptedBackupReceipt>('storage_persist_encrypted_backup', { input: { receipt, ciphertext: [...ciphertext] } });
    if (stored == null || stored.backupId !== receipt.backupId || stored.profileId !== receipt.profileId || stored.spaceId !== receipt.spaceId || stored.epoch !== receipt.epoch || stored.snapshotHash !== receipt.snapshotHash) throw new Error(failure);
    const bytes = await this.read(receipt);
    if (bytes.length !== ciphertext.length || bytes.some((byte, index) => byte !== ciphertext[index])) throw new Error(failure);
    return receipt;
  }

  /** Nur ein vollständig passender Beleg liest eine Chiffrathülle; keine Pfad-/SQL-Eingabe. */
  async read(receipt: EncryptedBackupReceipt): Promise<Uint8Array> {
    if (!validReceipt(receipt)) throw new Error('Die Sicherungshülle ist nicht gültig.');
    const bytes = await this.invoke<unknown>('storage_read_encrypted_backup', { receipt });
    if (!Array.isArray(bytes) || bytes.length === 0 || !bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error(failure);
    return Uint8Array.from(bytes as number[]);
  }
}
