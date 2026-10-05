// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, type Page } from '@playwright/test';
export const passphrase = 'p5-synthetisch-import-2026-passphrase';
export async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date('2028-03-31T12:00:00Z'));
  await page.goto('/'); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByLabel('Passphrase wiederholen').fill(passphrase); await page.getByRole('button', { name: 'Tresor anlegen' }).click(); await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check(); await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await page.getByRole('button', { name: 'Konten', exact: true }).click(); await page.getByLabel('Kontoname').fill('Giro P5'); await page.getByRole('button', { name: 'Konto anlegen' }).click(); await expect(page.getByRole('cell', { name: 'Giro P5' })).toBeVisible();
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click(); await page.getByLabel('Neue Kategoriegruppe').fill('Ausgaben P5'); await page.getByRole('button', { name: 'Gruppe anlegen' }).click(); await expect(page.getByLabel('Neue Kategoriegruppe')).toHaveValue(''); await page.getByRole('textbox', { name: 'Kategorie', exact: true }).fill('Lebensmittel P5'); await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: 'Ausgaben P5' }); await page.getByRole('button', { name: 'Kategorie anlegen' }).click(); await expect(page.getByRole('listitem').filter({ hasText: 'Lebensmittel P5' })).toBeVisible();
}
export async function importPreview(page: Page, data: string) {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const view = page.getByRole('region', { name: 'Dateiimport' });
  await view.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Giro P5' }); await view.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel P5' });
  const chooser = page.waitForEvent('filechooser'); await view.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'synthetisch.csv', mimeType: 'text/csv', buffer: Buffer.from(data) }); await view.getByRole('button', { name: 'Vorschau erstellen' }).click(); await expect(view.getByRole('status')).toContainText('Zeilen in der Vorschau'); return view;
}
