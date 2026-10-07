// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-1-4-lokale-passphrase-2026';
const profileKey = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
const wrongRecoveryCode = 'ungueltiger-rettungscode';

async function createPersistedVault(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  const recoveryCode = await page.getByRole('status', { name: 'Rettungscode' }).textContent();
  expect(recoveryCode).toBeTruthy();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  return recoveryCode!;
}

test('entsperrt einen gespeicherten Tresor in einer frischen Clientinstanz ausschließlich mit dem Rettungscode', async ({ browser, page }) => {
  const recoveryCode = await createPersistedVault(page);
  const persistedState = await page.context().storageState();
  const recoveryContext = await browser.newContext({ storageState: persistedState });
  const recoveryPage = await recoveryContext.newPage();

  try {
    await recoveryPage.goto('/');
    await expect(recoveryPage.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
    await expect(recoveryPage.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
    await expect.poll(() => recoveryPage.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key)).join('\n'))).not.toContain(recoveryCode);

    await recoveryPage.getByLabel('Rettungscode verwenden').check();
    await recoveryPage.getByRole('textbox', { name: 'Rettungscode' }).fill(wrongRecoveryCode);
    const storedProfileBefore = await recoveryPage.evaluate((key) => localStorage.getItem(key), profileKey);
    expect(storedProfileBefore).toBeTruthy();
    await recoveryPage.getByRole('button', { name: 'Entsperren' }).click();
    await expect(recoveryPage.getByRole('alert')).toHaveText('Der Tresor konnte nicht entsperrt werden. Passphrase oder Rettungscode prüfen.');
    await expect(recoveryPage.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
    await expect(recoveryPage.evaluate((key) => localStorage.getItem(key), profileKey)).resolves.toBe(storedProfileBefore);

    await recoveryPage.getByRole('textbox', { name: 'Rettungscode' }).fill(recoveryCode);
    await recoveryPage.getByRole('button', { name: 'Entsperren' }).click();
    await expect(recoveryPage.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
    await expect(recoveryPage.getByLabel('Bereich')).toHaveText('Privater Bereich');
  } finally {
    await recoveryContext.close();
  }
});
