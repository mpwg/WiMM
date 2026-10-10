// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, type Page } from '@playwright/test';
import { navigate, openBooking } from './ui.js';
export const passphrase = 'ux-flow-synthetische-passphrase-2026';
export async function createVault(page: Page) {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen', exact: true }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await unlock(page);
}
export async function unlock(page: Page) {
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.', exact: true })).toBeVisible();
}
export async function createCategory(page: Page, name: string, group = 'Alltag', kind = 'expense') {
  await navigate(page, 'Kategorien');
  await page.getByRole('button', { name: 'Neue Gruppe', exact: true }).click();
  await page.getByLabel('Neue Kategoriegruppe').fill(group);
  await page.getByRole('combobox', { name: 'Art', exact: true }).selectOption(kind);
  await page.getByRole('button', { name: 'Gruppe anlegen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Neue Kategorie', exact: true }).click();
  await page.getByRole('textbox', { name: 'Kategorie', exact: true }).fill(name);
  await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: group });
  await page.getByRole('button', { name: 'Kategorie anlegen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function createPayee(page: Page, name: string) {
  await navigate(page, 'Empfänger');
  await page.getByRole('button', { name: 'Neuer Empfänger', exact: true }).click();
  await page.getByRole('textbox', { name: 'Empfänger', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Empfänger anlegen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function book(page: Page, amount: string, note: string, account = 'Girokonto', category = 'Lebensmittel', payee?: string) {
  await navigate(page, 'Buchungen');
  const dialog = await openBooking(page);
  await dialog.getByRole('button', { name: amount.startsWith('-') ? 'Ausgabe' : 'Einnahme', exact: true }).click();
  await dialog.getByLabel('Betrag', { exact: true }).fill(amount.replace(/^[+-]/, ''));
  await dialog.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
  await dialog.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: category });
  if (payee) await dialog.getByRole('combobox', { name: 'Empfänger', exact: true }).selectOption({ label: payee });
  await dialog.getByLabel('Datum', { exact: true }).fill('2026-10-04');
  await dialog.locator('summary').filter({ hasText: /^Notiz$/ }).click();
  await dialog.getByLabel('Notiz', { exact: true }).fill(note);
  return dialog;
}
export async function saved(page: Page) {
  await page.getByRole('button', { name: 'Lokal speichern', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Neue Buchung', exact: true })).toHaveCount(0);
}
export const rows = (page: Page) => page.locator('[data-transaction-id]');
export async function details(page: Page, text: string | RegExp) {
  await rows(page).filter({ hasText: text }).getByRole('button', { name: /^Details:/ }).click();
  return page.getByRole('dialog');
}
const storageModule = '/@fs' + process.cwd() + '/packages/browser-adapters/src/sqlite-storage.ts';
const profileKey = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
export async function readAggregates(page: Page) {
  return page.evaluate(async ({ url, key }) => {
    const profile = JSON.parse(localStorage.getItem(key)!) as { profileId: string; selectedAreaId: string };
    const { BrowserSqliteStorageAdapter } = await import(/* @vite-ignore */ url) as typeof import('../../packages/browser-adapters/src/sqlite-storage.js');
    const storage = new BrowserSqliteStorageAdapter(profile.profileId);
    try { return await storage.query({ spaceId: profile.selectedAreaId }); }
    finally { await storage.close(); }
  }, { url: storageModule, key: profileKey });
}
