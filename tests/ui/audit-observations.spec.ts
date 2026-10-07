// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { createVault } from '../helpers/local.js';
import { createAccount, navigate, openBooking } from '../helpers/ui.js';
test('allein geänderte Buchungsrichtung bleibt beim Schließen geschützt', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Giro'); await navigate(page, 'Buchungen'); const form = await openBooking(page);
  await form.getByRole('button', { name: 'Einnahme', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter bearbeiten' }).click(); await expect(form.getByRole('button', { name: 'Einnahme', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
test('ausgewählte Importdatei ist bereits vor Vorschau beim Navigieren geschützt', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Giro'); await navigate(page, 'Import');
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'synthetisch.csv', mimeType: 'text/csv', buffer: Buffer.from('Datum;Betrag\n07.10.2026;1,00') });
  await expect(page.getByRole('region', { name: 'Dateiimport' }).getByRole('status')).toContainText('Datei lokal ausgewählt'); await navigate(page, 'Übersicht');
  await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toBeVisible(); await page.getByRole('button', { name: 'Weiter bearbeiten' }).click();
  await expect(page.getByRole('region', { name: 'Dateiimport' })).toContainText('synthetisch.csv');
});
