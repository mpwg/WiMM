// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-1-lokale-passphrase-2026';
const desktopClient = process.env.WIMM_CLIENT === 'desktop';

async function createAndUnlock(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Rettungscode sichern' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Rettungscode' })).not.toBeEmpty();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
}

test('öffnet vor bestätigtem Rettungscode keinen Bereich und persistiert weder Code noch Profil', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(message.text()));

  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill('abweichende-passphrase-2026');
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Die beiden Entsperrpassphrasen stimmen nicht überein.');
  await expect(page.getByRole('heading', { name: 'Lokalen Tresor anlegen' })).toBeVisible();

  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  const recoveryCode = await page.getByRole('status', { name: 'Rettungscode' }).textContent();
  expect(recoveryCode).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Lokalen Bereich eröffnen' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.values(localStorage))).not.toContain(recoveryCode);
  expect(consoleMessages).not.toContain(recoveryCode);
});

test('verwirft eine abgebrochene Tresoranlage ohne dauerhaftes Profil', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Rettungscode sichern' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lokalen Tresor anlegen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage))).toHaveLength(0);
});

test('bewahrt den Haushaltsschlüssel bei Sperren und standalone Neustart', async ({ page, context }) => {
  await createAndUnlock(page);
  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByText('Gemeinsamer Bereich')).toBeVisible();

  await page.getByRole('button', { name: 'Tresor sperren' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByLabel('Bereich')).toHaveValue(/.+/);
  await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);

  if (!desktopClient) {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
    await context.setOffline(true);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
});
