// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-1-7-offline-passphrase-2026';

async function createHousehold(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  const recoveryCode = await page.getByRole('status', { name: 'Rettungscode' }).textContent();
  expect(recoveryCode).toBeTruthy();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
  return recoveryCode!;
}

async function waitForPwaControl(page: Page): Promise<void> {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('wimm-app-assets-v1');
}

test('startet die PWA nach einem Offline-Neustart und öffnet den Haushalt über Passphrase und Rettungscode', async ({ page }) => {
  const recoveryCode = await createHousehold(page);
  await waitForPwaControl(page);

  await page.close();
  await page.context().setOffline(true);

  const passphraseRestart = await page.context().newPage();
  const passphraseResponse = await passphraseRestart.goto('/');
  expect(passphraseResponse?.status()).toBe(200);
  await expect(passphraseRestart.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible({ timeout: 15_000 });
  await expect(passphraseRestart.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
  await passphraseRestart.getByLabel('Entsperrpassphrase').fill(passphrase);
  await passphraseRestart.getByRole('button', { name: 'Entsperren' }).click();
  await expect(passphraseRestart.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(passphraseRestart.getByLabel('Bereich')).toHaveText(/Haushalt 1/);

  await passphraseRestart.getByRole('button', { name: 'Tresor sperren' }).click();
  await expect(passphraseRestart.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await passphraseRestart.close();

  const recoveryRestart = await page.context().newPage();
  const recoveryResponse = await recoveryRestart.goto('/');
  expect(recoveryResponse?.status()).toBe(200);
  await expect(recoveryRestart.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible({ timeout: 15_000 });
  await recoveryRestart.getByLabel('Rettungscode verwenden').check();
  await recoveryRestart.getByRole('textbox', { name: 'Rettungscode' }).fill(recoveryCode);
  await recoveryRestart.getByRole('button', { name: 'Entsperren' }).click();
  await expect(recoveryRestart.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(recoveryRestart.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
});
