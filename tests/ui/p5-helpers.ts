// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, type Page } from '@playwright/test';
import { createVault, createCategory } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
export { passphrase } from '../helpers/local.js';
export async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date('2028-03-31T12:00:00Z')); await createVault(page); await createAccount(page, 'Giro P5'); await createCategory(page, 'Lebensmittel P5', 'Ausgaben P5');
}
export async function importPreview(page: Page, data: string, mappingName?: string) {
  await navigate(page, 'Import');
  const view = page.getByRole('region', { name: 'Dateiimport' }); const chooser = page.waitForEvent('filechooser'); await view.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'synthetisch.csv', mimeType: 'text/csv', buffer: Buffer.from(data) });
  await view.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Giro P5' }); await view.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel P5' });
  if (mappingName) { await view.getByLabel('Vorlagenname').fill(mappingName); await view.getByRole('button', { name: 'Vorlage speichern' }).click(); await expect(view.getByRole('status')).toContainText('Mappingvorlage'); }
  await view.getByRole('button', { name: 'Vorschau erstellen' }).click(); await expect(view.getByRole('status')).toContainText('Zeilen in der Vorschau'); return view;
}
