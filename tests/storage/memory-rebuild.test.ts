// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { MemoryStorageAdapter } from '../../packages/storage/src/index.js';
import { financeSnapshot } from './contracts/rebuild-catalog.js';
import { normalized, profileId, spaceId } from './contracts/snapshot-catalog.js';
it('Memory berechnet dieselben Fachwerte und bewahrt den Bestand bei Abbruch vor Commit', async () => {
  let fail = false;
  const storage = new MemoryStorageAdapter(profileId, { beforeCommit(operation) { if (fail && operation === 'rebuildProjections') throw new Error('Synthetischer Abbruch'); } });
  await storage.replaceSnapshot(financeSnapshot());
  const before = normalized(await storage.exportSnapshot(spaceId));
  fail = true;
  await expect(storage.rebuildProjections(spaceId)).rejects.toThrow('Synthetischer Abbruch');
  expect(normalized(await storage.exportSnapshot(spaceId))).toEqual(before);
  fail = false;
  await storage.rebuildProjections(spaceId);
  expect(normalized(await storage.exportSnapshot(spaceId))).toEqual(before);
});
