// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, type Page } from '@playwright/test';

/** Tatsächliche Navigation einschließlich eigener mobiler Mehr-Ansicht. */
export async function navigate(page: Page, name: string) {
  const mobile = await page.locator('.mobile-navigation').isVisible();
  if (['Kategorien', 'Empfänger', 'Regeln', 'Dauerzahlungen', 'Einstellungen'].includes(name)) {
    if (mobile) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
    await page.getByRole('button', { name: /^Einstellungen/ }).click();
    if (name !== 'Einstellungen') await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  } else {
    if (mobile && ['Konten', 'Hilfe', 'Tresor sperren'].includes(name)) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
    if (name === 'Import') {
      await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
      await page.getByRole('button', { name: 'Importieren', exact: true }).click();
    } else await page.getByRole('button', { name, exact: true }).click();
  }
}

export async function createAccount(page: Page, name: string, opening = '', type = 'checking') {
  await navigate(page, 'Konten');
  await page.getByRole('button', { name: 'Neues Konto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Konto anlegen', exact: true });
  await dialog.getByLabel('Kontoname').fill(name);
  await dialog.getByRole('combobox', { name: 'Art', exact: true }).selectOption(type);
  if (opening !== '') await dialog.getByLabel('Anfangsbestand (optional)').fill(opening);
  await dialog.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

export async function openBooking(page: Page) {
  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  return page.getByRole('dialog', { name: 'Neue Buchung', exact: true });
}

export async function openAccountAction(page: Page, account: string, action: 'Umbuchen' | 'Abgleichen') {
  await navigate(page, 'Konten');
  if (await page.getByRole('button', { name: 'Zurück zu Konten' }).isVisible()) await page.getByRole('button', { name: 'Zurück zu Konten' }).click();
  await page.getByRole('button', { name: account, exact: true }).click();
  await page.getByRole('button', { name: action, exact: true }).click();
  return page.getByRole('form', { name: action === 'Umbuchen' ? 'Umbuchung' : 'Abgleich', exact: true });
}
