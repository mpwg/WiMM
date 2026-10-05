// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { book, createCategory, createVault, saved, rows } from '../helpers/local.js';
import { createAccount, navigate, openBooking } from '../helpers/ui.js';
test('erhält Buchungsreferenzen und Saldo eines archivierten Kontos, bietet es aber nicht für neue Buchungen an', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Girokonto Archivtest', '100'); await createAccount(page, 'Bargeldkasse Archivtest', '', 'cash'); await createCategory(page, 'Lebensmittel');
  await book(page, '-40', 'Archivierte Ausgabe', 'Girokonto Archivtest'); await saved(page);
  await navigate(page, 'Konten'); await page.getByRole('row').filter({ hasText: 'Girokonto Archivtest' }).getByRole('button', { name: 'Archivieren' }).click();
  await expect(page.getByRole('region', { name: 'Archivierte Konten', exact: true })).toContainText('60,00');
  await navigate(page, 'Buchungen'); await expect(rows(page)).toHaveCount(2); await expect(rows(page).filter({ hasText: 'Archivierte Ausgabe' })).toContainText('-€');
  const dialog = await openBooking(page); const selection = dialog.getByRole('combobox', { name: 'Konto', exact: true });
  await expect(selection.getByRole('option', { name: 'Girokonto Archivtest', exact: true })).toHaveCount(0);
  await expect(selection.getByRole('option', { name: 'Bargeldkasse Archivtest', exact: true })).toHaveCount(1);
});
