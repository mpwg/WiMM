// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { book, createCategory, createVault, saved, rows } from '../helpers/local.js';
import { createAccount, navigate, openBooking } from '../helpers/ui.js';
test('erhält die Kategorienreferenz einer archivierten Kategorie und bietet sie nicht für neue Buchungen an', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Girokonto'); await createCategory(page, 'Lebensmittel'); await book(page, '-40', 'Einkauf'); await saved(page);
  await navigate(page, 'Kategorien'); const item = page.getByRole('listitem').filter({ hasText: 'Lebensmittel' });
  await item.getByRole('button', { name: 'Archivieren' }).click(); await page.getByRole('button', { name: 'Archivieren bestätigen' }).click(); await expect(item).toHaveCount(0);
  await navigate(page, 'Buchungen'); await expect(rows(page)).toContainText('Lebensmittel');
  const dialog = await openBooking(page); await expect(dialog.getByRole('combobox', { name: 'Kategorie', exact: true }).getByRole('option', { name: 'Lebensmittel', exact: true })).toHaveCount(0);
  await dialog.getByText('Aufteilen', { exact: true }).click(); await expect(dialog.getByLabel('Split-Kategorie (optional)').getByRole('option', { name: 'Lebensmittel', exact: true })).toHaveCount(0);
});
