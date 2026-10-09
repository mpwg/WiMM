// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { createTauriStorageBridge, DesktopStorageAdapter } from './desktop-bridge.js';
import { StorageRevisionConflictError, StorageWriteError } from './contracts.js';

const profileId = '00000000-0000-4000-8000-000000000001' as never;
const spaceId = '00000000-0000-4000-8000-000000000011' as never;

describe('Tauri-Speicherbrücke', () => {
  it('normalisiert native Null-Lesestände und Revisionsfehler gemäß gemeinsamem Port', async () => {
    const adapter = new DesktopStorageAdapter(profileId, createTauriStorageBridge(async (command) => {
      if (command === 'storage_apply_batch') throw { contractVersion: 2, code: 'REVISION_CONFLICT', commitState: 'notCommitted' };
      return null as never;
    }));
    expect(await adapter.readAggregate(spaceId)).toBeUndefined();
    expect(await adapter.getSyncState(spaceId)).toBeUndefined();
    await expect(adapter.applyAtomicBatch({ expectedRevisions: [], aggregates: [], outbox: [], projections: [] })).rejects.toBeInstanceOf(StorageRevisionConflictError);
  });
  it('weist fremde Profilseiten bereits vor dem nativen Aufruf ab', async () => {
    let called = false;
    const adapter = new DesktopStorageAdapter(profileId, createTauriStorageBridge(async () => { called = true; return undefined as never; }));
    await expect(adapter.saveSyncPage({ state: { profileId: spaceId, spaceId, epoch: spaceId, cursor: '0' }, confirmed: [], removeOperationIds: [], projections: [] })).rejects.toBeInstanceOf(StorageWriteError);
    expect(called).toBe(false);
  });
  it('fragt Bereiche nur über den begrenzten Desktopbefehl ab', async () => {
    const calls: unknown[] = [];
    const bridge = createTauriStorageBridge(async (command, arguments_) => {
      calls.push({ command, arguments_ });
      return [] as never;
    });

    await expect(bridge.queryAggregates(profileId, spaceId)).resolves.toEqual([]);
    expect(calls).toEqual([{
      command: 'storage_query_aggregates',
      arguments_: { profileId, spaceId }
    }]);
  });
});
it('behandelt eine manipulierte Write-Erfolgsmeldung als unklar statt bestätigt', async () => {
  const bridge = createTauriStorageBridge(async () => ({ payload: 'secret', status: 'committed' }) as never);
  await expect(bridge.applyBatch({profileId,expectedRevisions:[],aggregates:[],outbox:[],projections:[]})).rejects.toMatchObject({code:'INVALID_RESPONSE',commitState:'unknown'});
});
