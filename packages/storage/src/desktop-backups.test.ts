// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { DesktopEncryptedBackupPort } from './desktop-backups.js';

const id = '00000000-0000-4000-8000-000000000001';
const input = { profileId: id, spaceId: id, epoch: id, snapshotHash: 'c3ludGhldGlzY2g', ciphertext: new Uint8Array([0, 255, 1, 128]) };
const receipt = { backupId: id, profileId: id, spaceId: id, epoch: id, snapshotHash: input.snapshotHash };
describe('Begrenzter nativer Sicherungsport', () => {
  it('bestätigt exakt gebundene Hülle und rückgelesene Bytes', async () => {
    const calls: unknown[] = [];
    const port = new DesktopEncryptedBackupPort({ next: () => id }, async (command, args) => {
      calls.push({ command, args });
      return (command === 'storage_persist_encrypted_backup' ? receipt : [...input.ciphertext]) as never;
    });
    expect(await port.persist(input)).toEqual(receipt);
    expect(calls).toEqual([
      { command: 'storage_persist_encrypted_backup', args: { input: { receipt, ciphertext: [...input.ciphertext] } } },
      { command: 'storage_read_encrypted_backup', args: { receipt } }
    ]);
  });
  it('akzeptiert weder fremden Beleg noch manipuliertes Chiffrat oder ungültige Bytewerte', async () => {
    for (const [stored, bytes] of [[{ ...receipt, snapshotHash: 'fremd' }, [0]], [receipt, [0, 255]], [receipt, [0, 255, 1, 256]], [receipt, [0, 255, 1, -1]], [receipt, [0, 255, 1, 1.5]], [null, []]] as const) {
      const port = new DesktopEncryptedBackupPort({ next: () => id }, async command => (command === 'storage_persist_encrypted_backup' ? stored : bytes) as never);
      await expect(port.persist(input)).rejects.toThrow('dauerhaft bestätigt');
    }
  });
  it('verhindert native Aufrufe bei ungültiger Hülle und gibt Schreibfehler weiter', async () => {
    let calls = 0;
    const port = new DesktopEncryptedBackupPort({ next: () => id }, async () => { calls++; throw new Error('Synthetischer Schreibfehler'); });
    await expect(port.persist({ ...input, ciphertext: new Uint8Array() })).rejects.toThrow('gültig');
    await expect(port.persist({ ...input, epoch: 'fremd' })).rejects.toThrow('gültig');
    expect(calls).toBe(0);
    await expect(port.persist(input)).rejects.toThrow('Synthetischer Schreibfehler');
    expect(calls).toBe(1);
  });
});
