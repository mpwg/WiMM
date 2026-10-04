// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-2-4-kategoriearchiv-passphrase-2026';
const account = 'Girokonto Kategoriearchivtest';
const group = 'Alltagsausgaben Archivtest';
const category = 'Lebensmittel Archivtest';

async function unlockLocalArea(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
}

test('erhält die Kategorienreferenz einer archivierten Kategorie und bietet sie nicht für neue Buchungen an', async ({ page }) => {
  await unlockLocalArea(page);

  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByLabel('Kontoname').fill(account);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: account })).toBeVisible();

  await page.getByRole('button', { name: 'Kategorien' }).click();
  await page.getByLabel('Neue Kategoriegruppe').fill(group);
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
  await expect(page.getByRole('combobox', { name: 'Gruppe' }).getByRole('option', { name: group })).toHaveCount(1);
  await page.getByLabel('Kategorie', { exact: true }).fill(category);
  await page.getByRole('combobox', { name: 'Gruppe' }).selectOption({ label: group });
  await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
  const categoryItem = page.getByRole('listitem').filter({ hasText: category });
  await expect(categoryItem).toBeVisible();

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: category });
  await page.getByLabel('Betrag').fill('-40,00');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${account}.*${category}.*-€\\s*40,00`) })).toBeVisible();

  await page.getByRole('button', { name: 'Kategorien' }).click();
  await categoryItem.getByRole('button', { name: 'Archivieren' }).click();
  await expect(categoryItem).toHaveCount(0);

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${account}.*${category}.*-€\\s*40,00`) })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Kategorie', exact: true }).getByRole('option', { name: category })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Split-Kategorie (optional)' }).getByRole('option', { name: category })).toHaveCount(0);
});
