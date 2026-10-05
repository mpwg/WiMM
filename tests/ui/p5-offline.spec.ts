// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { prepare, importPreview, passphrase } from './p5-helpers.js';
test('gebautes PWA lädt bisher ungenutzte Importworker ohne Netzwerk und übernimmt dauerhaft', async ({ page, context }) => {
  await prepare(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true); await page.reload(); await expect(page.getByLabel('Entsperrpassphrase')).toBeVisible(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  const view = await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1,23;Bäckerei;Offlineimporte;offline-1'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Abgeschlossen · 1 / 1');
  await page.reload(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await expect(page.locator('.overview-grid')).toContainText(/-€\s*1,23/); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(view).toContainText('Abgeschlossen · 1 / 1');
  await page.getByRole('button', { name: 'Tresor sperren' }).click(); await expect(page.getByRole('region', { name: 'Dateiimport' })).toHaveCount(0); await expect(page.locator('.overview-grid')).toHaveCount(0);
});
