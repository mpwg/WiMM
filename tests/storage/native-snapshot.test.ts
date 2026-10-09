// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { runSnapshotCase, snapshotCases } from './contracts/snapshot-catalog.js';
import { sqliteFixture } from './sqlite-fixture.js';
for (const scenario of snapshotCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: ${scenario}`, async () => {
    await expect(runSnapshotCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { runRebuildCase, rebuildCases } from './contracts/rebuild-catalog.js';
for (const scenario of rebuildCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: ${scenario}`, async () => {
    await expect(runRebuildCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { financeSnapshot } from './contracts/rebuild-catalog.js';
import { id, spaceId, normalized } from './contracts/snapshot-catalog.js';
import type { AccountAggregate } from '../../packages/domain/src/index.js';
import type { StoredAggregate } from '../../packages/storage/src/index.js';
import { StorageRevisionConflictError } from '../../packages/storage/src/index.js';
for (const change of ['neues-Aggregat', 'gleiche-Revision'] as const) {
  it(`SQLite-Neuaufbau weist veralteten vollständigen Lesestand ab: ${change}`, async () => {
    const fixture = await sqliteFixture();
    try {
      await fixture.storage.replaceSnapshot(financeSnapshot());
      const account = financeSnapshot().aggregates.find((entry) => entry.id === id(10))! as StoredAggregate & AccountAggregate;
      const changed = { ...account, ...(change === 'neues-Aggregat' ? { id: id(99), handle: id(99) } : {}), name: 'Konkurrierend geändert' };
      fixture.beforeNextRebuild!((storage) => storage.applyAtomicBatch({ expectedRevisions: [], aggregates: [changed], outbox: [], projections: [] }));
      await expect(fixture.storage.rebuildProjections(spaceId)).rejects.toBeInstanceOf(StorageRevisionConflictError);
      const snapshot = normalized(await fixture.storage.exportSnapshot(spaceId));
      expect(snapshot.projections).toEqual(normalized(financeSnapshot()).projections);
      expect((snapshot.aggregates.find((entry) => entry.id === (change === 'neues-Aggregat' ? id(99) : id(10))) as StoredAggregate & AccountAggregate).name).toBe('Konkurrierend geändert');
    } finally { await fixture.close(); }
  });
}

import { runMergeCase, mergeCases } from './contracts/merge-catalog.js';
for (const scenario of mergeCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: Empfängermerge ${scenario}`, async () => {
    await expect(runMergeCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { runVersionCase, versionCases } from './contracts/version-catalog.js';
for (const scenario of versionCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: unbekannte ${scenario}-Version`, async () => {
    await expect(runVersionCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}

import { createEncryptedJsonSnapshotProtector, canonicalJsonBytes } from '../../packages/crypto/src/index.js';
import { p5Snapshot } from './contracts/snapshot-catalog.js';
import type { LocalSnapshot } from '../../packages/storage/src/index.js';
it('Native SQLite-Sicherung bewahrt echten verschlüsselten P5-Snapshot über Rust-Prozessneustart', async () => {
  const fixture = await sqliteFixture();
  try {
    const snapshot = p5Snapshot();
    await fixture.storage.replaceSnapshot(snapshot);
    const source = normalized(await fixture.storage.exportSnapshot(snapshot.spaceId));
    const protector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
    const ciphertext = await protector.seal(source);
    const snapshotHash = Buffer.from(await crypto.subtle.digest('SHA-256', new Uint8Array(canonicalJsonBytes(source)))).toString('base64url');
    const receipt = await fixture.backups.persist({ profileId: source.profileId, spaceId: source.spaceId, epoch: source.epoch, snapshotHash, ciphertext });
    await fixture.restart();
    const saved = await fixture.backups.read(receipt);
    expect(saved).toEqual(ciphertext);
    expect(await protector.unseal(saved)).toEqual(source);
    expect(new TextDecoder().decode(saved)).not.toContain('aggregateType');
    await expect(fixture.backups.persist({ profileId: source.profileId, spaceId: source.spaceId, epoch: source.epoch, snapshotHash, ciphertext: new Uint8Array([99]) })).rejects.toMatchObject({code:'WRITE_FAILED',commitState:'notCommitted'});
    await expect(fixture.backups.read({ ...receipt, epoch: id(9998) })).rejects.toMatchObject({code:'WRITE_FAILED',commitState:'notCommitted'});
    const wrongKey = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(8));
    await expect(wrongKey.unseal(saved)).rejects.toThrow('Der Tresor konnte nicht entsperrt werden.');
    expect(await fixture.backups.read(receipt)).toEqual(ciphertext);
    expect(normalized(await fixture.storage.exportSnapshot(snapshot.spaceId))).toEqual(source);
  } finally { await fixture.close(); }
}, 30_000);

import { migrationCases,runMigrationCase } from './contracts/migration-catalog.js';
for(const scenario of migrationCases){it(`Gesicherte SQLite-Vorwärtsmigration: ${scenario}`,async()=>{await expect(runMigrationCase(scenario,await sqliteFixture())).resolves.toBeUndefined();},30_000);}
import {runIndexMaintenanceCase} from './contracts/migration-catalog.js';
it('SQLite-Indizes bleiben bei Änderung, Tombstone, CAS-Fehler und Snapshotersatz atomar',async()=>{await expect(runIndexMaintenanceCase(await sqliteFixture())).resolves.toBeUndefined();},30_000);
import {runIndexPerformanceCase} from './contracts/migration-catalog.js';
it('50.000 Buchungen: gesicherte SQLite-Migration und tatsächliche Indexabfragen',async()=>{const metrics=await runIndexPerformanceCase(await sqliteFixture());expect(metrics.count).toBe(50_000);await (await import('node:fs/promises')).writeFile('test-results/migration-index-metrics-sqlite.json',JSON.stringify(metrics,null,2));},120_000);
import {runIndexProfileCase} from './contracts/migration-catalog.js';
it('SQLite-Indexmigration und Abfragen bewahren fremde Profile mit denselben Handles',async()=>{await expect(runIndexProfileCase(await sqliteFixture())).resolves.toBeUndefined();},30_000);
