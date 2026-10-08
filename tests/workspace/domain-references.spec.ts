// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/domain-regressions.js';

for (const target of ['account', 'category', 'categoryGroup', 'payee'] as const) {
  test(`weist neue Referenzen auf gelöschte ${target}-Ziele ohne Speicheränderung ab`, async ({ page }) => {
    await page.goto('/tests/domain-regressions.html');
    await page.waitForFunction(() => window.domainRegression !== undefined);
    expect(await page.evaluate((scenario) => window.domainRegression(scenario), target)).toMatchObject({ code: 'INVALID_AGGREGATE', unchanged: true });
  });
}
test('verhindert ausgelassene Quellbuchungen im echten IndexedDB-Bestand', async ({ page }) => {
  await page.goto('/tests/domain-regressions.html'); await page.waitForFunction(() => window.domainRegression !== undefined);
  expect(await page.evaluate(() => window.domainRegression('merge-omitted'))).toMatchObject({ code: 'INVALID_COMMAND', unchanged: true, sourceArchived: false });
});
test('rollt einen Merge nach gleichzeitiger neuer Quellbuchung vollständig zurück', async ({ page }) => {
  await page.goto('/tests/domain-regressions.html'); await page.waitForFunction(() => window.domainRegression !== undefined);
  expect(await page.evaluate(() => window.domainRegression('merge-stale'))).toMatchObject({ code: 'STORAGE_REVISION_CONFLICT', unchanged: true, sourceArchived: false });
});
test('committet vollständige Empfängeränderung mit erhaltenen Buchungsfeldern', async ({ page }) => {
  await page.goto('/tests/domain-regressions.html'); await page.waitForFunction(() => window.domainRegression !== undefined);
  expect(await page.evaluate(() => window.domainRegression('merge-complete'))).toMatchObject({ code: 'OK', sourceArchived: true, transaction: { amount: -100, date: '2026-10-08', clearance: 'cleared', note: 'Historische Testbuchung', payeeId: '00000000-0000-4000-8000-000000000007', revision: 2 } });
});

for (const filled of [false, true]) {
  test(`exportiert ${filled ? 'befüllte' : 'leere'} lokale Bereiche verschlüsselt und erhält Epoche bei Neustart`, async ({ page }) => {
    await page.goto('/tests/domain-regressions.html'); await page.waitForFunction(() => window.localSnapshotRegression !== undefined);
    expect(await page.evaluate((value) => window.localSnapshotRegression(value), filled)).toEqual({ epoch: '00000000-0000-4000-8000-000000000095', stableEpoch: true, wrongKeyRejected: true, unchanged: true, noOutbox: true, noSyncState: true, encrypted: true });
  });
}
