// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Browser, type Page, type StorageState } from '@playwright/test';

const passphrase = 'p4-1-5-lokale-passphrase-2026';
const profileStorageKey = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';

async function createHousehold(page: Page): Promise<{ readonly recoveryCode: string; readonly nonceBefore: string; readonly householdId: string }> {
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

  const nonceBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).vault.vault.nonce as string, profileStorageKey);
  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
  const householdId = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).selectedAreaId as string, profileStorageKey);
  return { recoveryCode: recoveryCode!, nonceBefore, householdId };
}

async function expectHouseholdAfterRestart(browser: Browser, state: StorageState, secret: string, recovery: boolean, householdId: string): Promise<void> {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
    if (recovery) await page.getByLabel('Rettungscode verwenden').check();
    await page.getByRole('textbox', { name: recovery ? 'Rettungscode' : 'Entsperrpassphrase' }).fill(secret);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
    await expect(page.getByLabel('Bereich')).toHaveValue(householdId);
  } finally {
    await context.close();
  }
}

test('sichert einen neuen Haushalt mit frischer Nonce und stellt ihn nach Neustart über beide Entsperrwege wieder her', async ({ browser, page }) => {
  const { recoveryCode, nonceBefore, householdId } = await createHousehold(page);
  const storedRecord = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), profileStorageKey);
  expect(storedRecord.vault.vault.nonce).not.toBe(nonceBefore);
  expect(JSON.stringify(storedRecord)).not.toContain(recoveryCode);
  const state = await page.context().storageState();

  await expectHouseholdAfterRestart(browser, state, passphrase, false, householdId);
  await expectHouseholdAfterRestart(browser, state, recoveryCode, true, householdId);
});
