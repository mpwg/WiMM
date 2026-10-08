// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { runSnapshotCase, snapshotCases } from './contracts/snapshot-catalog.js';
import { sqliteFixture } from './sqlite-fixture.js';
for (const scenario of snapshotCases) {
  it(`Echter DesktopStorageAdapter/Rust/SQLite: ${scenario}`, async () => {
    await expect(runSnapshotCase(scenario, await sqliteFixture())).resolves.toBeUndefined();
  }, 30_000);
}
