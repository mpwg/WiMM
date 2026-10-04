// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-2-2-kontostart-passphrase-2026';
const accountName = 'Girokonto Kontostart';

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

test('zeigt den leeren Bereich und erhält einen Anfangsbestand ohne Konsumeinnahme nach dem Neuladen', async ({ page }) => {
  await unlockLocalArea(page);

  await expect(page.getByRole('heading', { name: 'Noch keine Konten' })).toBeVisible();
  await expect(page.getByText('Erfundenes Guthaben zeigt die Übersicht nicht.')).toBeVisible();
  await expect(page.getByText(/^0,00\s*€/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByLabel('Kontoname').fill(accountName);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: accountName })).toBeVisible();

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await page.getByLabel('Anfangsbestand').check();
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: accountName });
  await page.getByLabel('Betrag').fill('1000,00');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByText('Lokal gespeichert.')).toBeVisible();

  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.getByText('Verfügbares Geld')).toBeVisible();
  await expect(page.getByText('Monatsausgaben')).toBeVisible();
  await expect(page.locator('.overview-grid article').nth(0).getByText(/€\s*1[.\u00a0 ]?000,00/)).toBeVisible();
  await expect(page.locator('.overview-grid article').nth(1).getByText(/€\s*0,00/)).toBeVisible();

  await page.reload();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(page.locator('.overview-grid article').nth(0).getByText(/€\s*1[.\u00a0 ]?000,00/)).toBeVisible();
  await expect(page.locator('.overview-grid article').nth(1).getByText(/€\s*0,00/)).toBeVisible();

  await page.getByRole('button', { name: 'Konten' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${accountName}.*€\\s*1[.\\u00a0 ]?000,00`) })).toBeVisible();
});
