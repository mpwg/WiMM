// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { prepare, importPreview, passphrase } from './p5-helpers.js';
for (const touch of [false, true]) test.describe(touch ? 'Touch' : 'Tastatur', () => {
  test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
  test('korrigiert ungültige CSV-Zeilen, übernimmt bestätigt und prüft Wiederimport', async ({ page }, info) => {
    await prepare(page);
    const csv = 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,56;Bäckerei;Öl;1\n31.02.2028;-2,00;Markt;Obst;2';
    const view = await importPreview(page, csv);
    await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await expect(view.getByRole('status')).toContainText('ausdrückliche Entscheidung');
    const bad = view.locator('.import-preview > li').nth(1); await bad.getByText('Zeile korrigieren', { exact: true }).click(); await bad.getByLabel('Korrigiertes Datum').fill('2028-02-29'); await bad.getByLabel('Korrigierter Betrag (Dezimalpunkt)').fill('-2.00'); const correction = bad.getByRole('button', { name: 'Korrektur prüfen' }); if (touch) await correction.tap(); else { await correction.focus(); await page.keyboard.press('Enter'); }
    await expect(bad).toContainText('2028-02-29'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Abgeschlossen · 2 / 2');
    await page.getByRole('button', { name: 'Buchungen', exact: true }).first().click(); await expect(page.getByRole('region', { name: 'Buchungsliste' })).toContainText('Bäckerei');
    await page.getByRole('button', { name: 'Übersicht', exact: true }).first().click(); await expect(page.locator('.overview-grid')).toContainText(/-€\s*1\.236,56/);
    await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,56;Bäckerei;Öl;1'); await expect(view.locator('.import-preview')).toContainText('Mögliche Dublette'); await view.getByLabel('Entscheidung Zeile 1').selectOption('separate'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view.getByText('Abgeschlossen · 1 / 1')).toBeVisible();
    await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,55;Bäckerei;Öl;1'); await expect(view.locator('.import-preview')).toContainText('Prüfkonflikt'); await view.getByLabel('Entscheidung Zeile 1').selectOption('exclude'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view.getByText('Abgeschlossen · 1 / 1')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath('p5-import.png'), fullPage: true });
  });
  test('speichert Vorlage, Regeln und F14; ordnet Import ohne zweite Zahlung zu', async ({ page }, info) => {
    await prepare(page); const view = await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1,00;Bank;Miete;42'); await view.getByLabel('Vorlagenname').fill('Meine Bank'); await view.getByRole('button', { name: 'Vorlage speichern' }).click(); await expect(view.getByRole('status')).toContainText('Mappingvorlage'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Abgeschlossen');
    await page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }).click(); await page.getByLabel('Bedingungswert').fill('Miete'); await page.getByRole('combobox', { name: 'Kategorie', exact: true }).first().selectOption({ label: 'Lebensmittel P5' }); await page.getByRole('button', { name: 'Regel anlegen' }).click(); await expect(page.getByRole('button', { name: 'Regel deaktivieren' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Giro P5' }); await page.getByRole('combobox', { name: 'Kategorie', exact: true }).nth(1).selectOption({ label: 'Lebensmittel P5' }); await page.getByLabel('Dauerzahlungsbetrag').fill('-1,00'); await page.getByLabel('Erste Fälligkeit').fill('2028-01-31'); await page.getByLabel('Dauerzahlungsnotiz').fill('Miete P5'); await page.getByRole('button', { name: 'Dauerzahlung anlegen' }).click(); await expect(page.getByText('Fällig: 2028-02-29')).toBeVisible(); await expect(page.getByText('Fällig: 2028-03-31')).toBeVisible();
    const first = page.locator('.inline-form').filter({ has: page.getByText('Fällig: 2028-01-31', { exact: true }) }); await first.getByRole('combobox', { name: 'Importierte Zahlung' }).selectOption({ index: 1 }); await first.getByRole('button', { name: 'Import zuordnen' }).click(); await expect(page.getByText('Fällig: 2028-01-31')).toHaveCount(0); const feb = page.locator('.inline-form').filter({ has: page.getByText('Fällig: 2028-02-29', { exact: true }) }); await feb.getByRole('button', { name: 'Zahlung bestätigen' }).click(); await expect(page.getByText('Fällig: 2028-02-29')).toHaveCount(0); await page.getByRole('button', { name: 'Fälligkeit überspringen' }).click(); await expect(page.getByRole('button', { name: 'Zahlung bestätigen' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).first().click(); await expect(page.locator('.overview-grid')).toContainText(/-€\s*2,00/);
    await page.reload(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }).click(); await expect(page.getByRole('button', { name: 'Zahlung bestätigen' })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Regel deaktivieren' })).toBeVisible();
    await page.getByRole('button', { name: 'Import', exact: true }).click(); await view.getByRole('combobox', { name: 'Vorlage', exact: true }).selectOption({ label: 'Meine Bank' }); await expect(view.getByLabel('Vorlagenname')).toHaveValue('Meine Bank'); await page.screenshot({ path: info.outputPath('p5-automation.png'), fullPage: true });
  });
});

test('verlangt eine Vorschauentscheidung auch für gleiche Zeilen derselben Datei', async ({ page }) => {
  await prepare(page);
  const view = await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1,00;Markt;Obst;\n31.01.2028;-1,00;Markt;Obst;');
  await expect(view.locator('.import-preview > li').nth(1)).toContainText('Mögliche Dublette');
  await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click();
  await expect(view.getByRole('status')).toContainText('ausdrückliche Entscheidung');
  await view.getByLabel('Entscheidung Zeile 2').selectOption('separate');
  await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click();
  await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click();
  await expect(view).toContainText('Abgeschlossen · 2 / 2');
});
