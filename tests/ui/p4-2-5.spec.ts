// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test } from '@playwright/test';
import { book, createCategory, createPayee, createVault, saved, rows, unlock } from '../helpers/local.js';
import { createAccount, navigate, openBooking } from '../helpers/ui.js';
test('führt einen referenzierten Empfänger zusammen und erhält Buchung und Archivierung nach Chromium-Neustart', async ({ baseURL }, info) => {
  if (baseURL === undefined) throw new Error('Clientadresse fehlt'); const launch = () => chromium.launchPersistentContext(info.outputPath('chromium-profile'), { channel: 'chromium-headless-shell', headless: true, baseURL });
  let context = await launch();
  try {
    let page = await context.newPage(); await createVault(page); await createAccount(page, 'Girokonto'); await createCategory(page, 'Lebensmittel');
    await createPayee(page, 'Bäckerei am Hauptplatz'); await createPayee(page, 'Bäckerei Hauptplatz');
    await book(page, '-40', 'Einkauf', 'Girokonto', 'Lebensmittel', 'Bäckerei am Hauptplatz'); await saved(page);
    await navigate(page, 'Empfänger'); await page.getByRole('button', { name: 'Empfänger zusammenführen', exact: true }).click();
    await page.getByLabel('Quell-Empfänger').selectOption({ label: 'Bäckerei am Hauptplatz' }); await page.getByLabel('Ziel-Empfänger').selectOption({ label: 'Bäckerei Hauptplatz' });
    await page.getByRole('button', { name: 'Zusammenführen und archivieren' }).click(); await page.getByRole('button', { name: 'Zusammenführen', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await context.close(); context = await launch(); page = await context.newPage(); await page.goto('/');
    await expect(page.locator('.app-shell')).toHaveCount(0); await unlock(page); await navigate(page, 'Empfänger');
    await expect(page.getByText('Bäckerei am Hauptplatz', { exact: true })).toHaveCount(0);
    await navigate(page, 'Buchungen'); await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Bäckerei Hauptplatz'); await expect(rows(page)).toContainText('40,00'); await expect(rows(page)).toContainText('04.10.2026'); await expect(rows(page)).toContainText('Lebensmittel');
    const dialog = await openBooking(page); const selection = dialog.getByRole('combobox', { name: 'Empfänger', exact: true });
    await expect(selection.getByRole('option', { name: 'Bäckerei am Hauptplatz', exact: true })).toHaveCount(0); await expect(selection.getByRole('option', { name: 'Bäckerei Hauptplatz', exact: true })).toHaveCount(1);
  } finally { await context.close(); }
});
