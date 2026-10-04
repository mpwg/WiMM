// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-2-3-kontoarchiv-passphrase-2026';
const archivedAccount = 'Girokonto Archivtest';
const activeAccount = 'Bargeldkasse Archivtest';

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

test('erhält Buchungsreferenzen und Saldo eines archivierten Kontos, bietet es aber nicht für neue Buchungen an', async ({ page }) => {
  await unlockLocalArea(page);

  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByLabel('Kontoname').fill(archivedAccount);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: archivedAccount })).toBeVisible();
  await page.getByLabel('Kontoname').fill(activeAccount);
  await page.getByLabel('Art').selectOption('cash');
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: activeAccount })).toBeVisible();

  await page.getByRole('button', { name: 'Kategorien' }).click();
  await page.getByLabel('Neue Kategoriegruppe').fill('Alltag');
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
  await expect(page.getByRole('combobox', { name: 'Gruppe' }).getByRole('option', { name: 'Alltag' })).toHaveCount(1);
  await page.getByLabel('Kategorie', { exact: true }).fill('Lebensmittel');
  await page.getByRole('combobox', { name: 'Gruppe' }).selectOption({ label: 'Alltag' });
  await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lebensmittel' })).toBeVisible();

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await page.getByLabel('Anfangsbestand').check();
  await page.getByLabel('Konto').selectOption({ label: archivedAccount });
  await page.getByLabel('Betrag').fill('100,00');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByText('Lokal gespeichert.')).toBeVisible();
  await page.getByLabel('Anfangsbestand').uncheck();
  await page.getByLabel('Konto').selectOption({ label: archivedAccount });
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel' });
  await page.getByLabel('Betrag').fill('-40,00');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${archivedAccount}.*-€\\s*40,00`) })).toBeVisible();

  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByRole('row', { name: new RegExp(`^${archivedAccount}`) }).getByRole('button', { name: 'Archivieren' }).click();
  await expect(page.getByRole('heading', { name: 'Archivierte Konten' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${archivedAccount}.*60,00.*Archiviert`) })).toBeVisible();

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${archivedAccount}.*100,00`) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${archivedAccount}.*-€\\s*40,00`) })).toBeVisible();
  await expect(page.getByLabel('Konto').getByRole('option', { name: archivedAccount })).toHaveCount(0);
  await expect(page.getByLabel('Konto').getByRole('option', { name: activeAccount })).toHaveCount(1);
});
