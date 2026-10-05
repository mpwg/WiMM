// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createVault } from '../helpers/local.js';
async function activate(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement)) {
      expect(await target.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none'); await page.keyboard.press('Enter'); return;
    }
  }
  throw new Error('Aktion nicht per Tabulator erreichbar');
}
test('bedient Bereich, Navigation und Stammdaten per Tastatur und gibt den Dialogfokus zurück', async ({ page }) => {
  await createVault(page);
  await activate(page, page.getByRole('button', { name: 'Haushalt anlegen', exact: true })); await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();
  const area = page.getByLabel('Bereich'); await area.focus(); await page.keyboard.press('p'); await expect(page.getByText('Privatbereich', { exact: true })).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Konten', exact: true }));
  await activate(page, page.getByRole('button', { name: 'Neues Konto', exact: true })); await expect(page.getByLabel('Kontoname')).toBeFocused(); await page.keyboard.type('Girokonto Tastatur'); await activate(page, page.getByRole('button', { name: 'Konto anlegen', exact: true })); await expect(page.getByRole('button', { name: 'Neues Konto', exact: true })).toBeFocused();
  await activate(page, page.getByRole('button', { name: 'Einstellungen', exact: true })); await activate(page, page.getByRole('button', { name: /^Kategorien/ })); await activate(page, page.getByRole('button', { name: 'Neue Gruppe', exact: true })); await page.keyboard.type('Alltag'); await activate(page, page.getByRole('button', { name: 'Gruppe anlegen', exact: true })); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Neue Gruppe', exact: true })).toBeFocused();
  await activate(page, page.getByRole('button', { name: 'Neue Kategorie', exact: true })); await page.keyboard.type('Lebensmittel'); await page.keyboard.press('Tab'); await page.keyboard.press('a'); await activate(page, page.getByRole('button', { name: 'Kategorie anlegen', exact: true })); await expect(page.getByRole('listitem')).toContainText('Lebensmittel'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Neue Kategorie', exact: true })).toBeFocused();
  await activate(page, page.getByRole('button', { name: 'Alle Einstellungen' })); await activate(page, page.getByRole('button', { name: /^Empfänger/ }));
  for (const name of ['Bäckerei Quelle', 'Bäckerei Ziel']) { await activate(page, page.getByRole('button', { name: 'Neuer Empfänger', exact: true })); await page.keyboard.type(name); await activate(page, page.getByRole('button', { name: 'Empfänger anlegen', exact: true })); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Neuer Empfänger', exact: true })).toBeFocused(); }
  const trigger = page.getByRole('button', { name: 'Empfänger zusammenführen', exact: true }); await activate(page, trigger);
  await page.getByLabel('Quell-Empfänger').focus(); await page.keyboard.press('b'); await page.keyboard.press('Tab'); await page.keyboard.press('b'); await activate(page, page.getByRole('button', { name: 'Zusammenführen und archivieren' }));
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toBeVisible(); await activate(page, page.getByRole('button', { name: 'Weiter bearbeiten' })); await expect(page.getByRole('dialog', { name: 'Empfänger zusammenführen', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await activate(page, page.getByRole('button', { name: 'Eingaben verwerfen' })); await expect(trigger).toBeFocused();
});
