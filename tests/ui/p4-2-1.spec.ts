// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-2-1-navigation-passphrase-2026';

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

async function addAccount(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByLabel('Kontoname').fill(name);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name })).toBeVisible();
}

test('macht Navigation und aktiven Bereich sichtbar und trennt private von gemeinsamen Konten', async ({ page }) => {
  const privateAccount = 'Privatkonto Navigationstest';
  const householdAccount = 'Haushaltskonto Navigationstest';

  await unlockLocalArea(page);
  await expect(page.getByText('Privatbereich', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Bereich')).toHaveValue(/.+/);
  await addAccount(page, privateAccount);

  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: privateAccount })).toHaveCount(0);
  await addAccount(page, householdAccount);

  for (const [button, heading] of [['Übersicht', 'Übersicht'], ['Buchungen', 'Buchungen'], ['Kategorien', 'Kategorien'], ['Empfänger', 'Empfänger'], ['Konten', 'Konten']] as const) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('cell', { name: householdAccount })).toBeVisible();
  await expect(page.getByText(privateAccount, { exact: true })).toHaveCount(0);

  await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await expect(page.getByText('Privatbereich', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: privateAccount })).toBeVisible();
  await expect(page.getByText(householdAccount, { exact: true })).toHaveCount(0);
});
