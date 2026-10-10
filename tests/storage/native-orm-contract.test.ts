// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect,it } from 'vitest';
import { sqliteFixture } from './sqlite-fixture.js';
import { snapshotCases,runSnapshotCase } from './contracts/snapshot-catalog.js';
import { rebuildCases,runRebuildCase } from './contracts/rebuild-catalog.js';
import { mergeCases,runMergeCase } from './contracts/merge-catalog.js';
import { versionCases,runVersionCase } from './contracts/version-catalog.js';
for(const scenario of snapshotCases)it(`Ziel-ORM/echte SQLite: ${scenario}`,async()=>{await expect(runSnapshotCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of rebuildCases)it(`Ziel-ORM/echte SQLite: ${scenario}`,async()=>{await expect(runRebuildCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of mergeCases)it(`Ziel-ORM/echte SQLite: Merge ${scenario}`,async()=>{await expect(runMergeCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
for(const scenario of versionCases)it(`Ziel-ORM/echte SQLite: Version ${scenario}`,async()=>{await expect(runVersionCase(scenario,await sqliteFixture('orm'))).resolves.toBeUndefined();},30_000);
