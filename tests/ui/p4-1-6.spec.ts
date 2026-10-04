// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const profileStorageKey = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
const passphraseA = 'p4-1-6-profil-a-passphrase-2026';
const passphraseB = 'p4-1-6-profil-b-passphrase-2026';

async function createAndUnlockProfile(page: Page, passphrase: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Lokalen Tresor anlegen' })).toBeVisible();
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

test('trennt zwei Profile, private und gemeinsame Bereichsdaten sowie offene Eingabeentwürfe', async ({ page }) => {
  await page.goto('/');
  await createAndUnlockProfile(page, passphraseA);

  await addAccount(page, 'Privatkonto Profil A');
  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByLabel('Bereich')).toHaveText(/Haushalt 1/);
  await expect(page.getByText('Privatkonto Profil A', { exact: true })).toHaveCount(0);
  await addAccount(page, 'Haushaltskonto Profil A');

  await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await expect(page.getByRole('cell', { name: 'Privatkonto Profil A' })).toBeVisible();
  await expect(page.getByText('Haushaltskonto Profil A', { exact: true })).toHaveCount(0);

  await page.getByLabel('Kontoname').fill('Privater, noch nicht gespeicherter Entwurf');
  await page.getByLabel('Bereich').selectOption({ label: 'Haushalt 1' });
  await expect(page.getByLabel('Kontoname')).toHaveValue('');
  await expect(page.getByText('Privater, noch nicht gespeicherter Entwurf', { exact: true })).toHaveCount(0);

  await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await expect(page.getByRole('cell', { name: 'Privatkonto Profil A' })).toBeVisible();

  const profileA = await page.evaluate((key) => localStorage.getItem(key), profileStorageKey);
  expect(profileA).not.toBeNull();
  await page.evaluate((key) => localStorage.removeItem(key), profileStorageKey);
  await page.reload();
  await createAndUnlockProfile(page, passphraseB);
  await addAccount(page, 'Privatkonto Profil B');
  await expect(page.getByText('Privatkonto Profil A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Haushaltskonto Profil A', { exact: true })).toHaveCount(0);

  await page.evaluate(({ key, profile }) => localStorage.setItem(key, profile), { key: profileStorageKey, profile: profileA! });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await expect(page.getByText('Privatkonto Profil A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Privatkonto Profil B', { exact: true })).toHaveCount(0);
  await page.getByLabel('Entsperrpassphrase').fill(passphraseA);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await page.getByRole('button', { name: 'Konten' }).click();
  await expect(page.getByRole('cell', { name: 'Privatkonto Profil A' })).toBeVisible();
  await expect(page.getByText('Privatkonto Profil B', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tresor sperren' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
  await expect(page.getByText('Privatkonto Profil A', { exact: true })).toHaveCount(0);
});
