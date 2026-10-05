// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-1-3-lokale-passphrase-2026';
const wrongPassphrase = 'p4-1-3-falsche-passphrase-2026';

async function createAndUnlock(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
}

test('sperrt Finanzansicht, weist eine falsche Passphrase ab und stellt den Bereich nach Neustart wieder her', async ({ page }) => {
  await createAndUnlock(page);
  await expect(page.getByLabel('Bereich')).toHaveText('Privater Bereich');

  await page.getByRole('button', { name: 'Tresor sperren' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
  await expect(page.getByText('Privatbereich')).toHaveCount(0);

  await page.getByLabel('Entsperrpassphrase').fill(wrongPassphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('alert')).toHaveText('Der Tresor konnte nicht entsperrt werden. Passphrase oder Rettungscode prüfen.');
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);

  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  await expect(page.getByLabel('Bereich')).toHaveText('Privater Bereich');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  await expect(page.getByLabel('Bereich')).toHaveText('Privater Bereich');
});
