// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { prepare, importPreview, passphrase } from './p5-helpers.js';
import { navigate } from '../helpers/ui.js';
for (const touch of [false, true]) test.describe(touch ? 'Touch' : 'Tastatur', () => {
  test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
  test('korrigiert ungültige CSV-Zeilen, übernimmt bestätigt und prüft Wiederimport', async ({ page }, info) => {
    await prepare(page);
    const csv = 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,56;Bäckerei;Öl;1\n31.02.2028;-2,00;Markt;Obst;2';
    const view = await importPreview(page, csv);
    await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await expect(view.getByRole('status')).toContainText('ausdrückliche Entscheidung');
    await view.getByRole('button', { name: 'Zurück zur Vorschau' }).click(); const bad = view.locator('.import-preview > li').nth(1); await bad.getByText('Zeile korrigieren', { exact: true }).click(); await bad.getByLabel('Korrigiertes Datum').fill('2028-02-29'); await bad.getByLabel('Korrigierter Betrag (Dezimalpunkt)').fill('-2.00'); const correction = bad.getByRole('button', { name: 'Korrektur prüfen' }); if (touch) await correction.tap(); else { await correction.focus(); await page.keyboard.press('Enter'); }
    await expect(bad).toContainText('2028-02-29'); await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Fortsetzen (bis 100 Buchungen)' }).click(); await expect(view).toContainText('Abgeschlossen · 2 / 2');
    await page.getByRole('button', { name: 'Buchungen', exact: true }).first().click(); await expect(page.getByRole('region', { name: 'Buchungsliste' })).toContainText('Bäckerei');
    await page.getByRole('button', { name: 'Übersicht', exact: true }).first().click(); await expect(page.locator('.overview-hero')).toContainText(/-€\s*1\.236,56/);
    await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,56;Bäckerei;Öl;1'); await expect(view.locator('.import-preview')).toContainText('Mögliche Dublette'); await view.getByLabel('Entscheidung Zeile 1').selectOption('separate'); await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Fortsetzen (bis 100 Buchungen)' }).click(); await expect(view.getByText('Abgeschlossen · 1 / 1')).toBeVisible();
    await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234,55;Bäckerei;Öl;1'); await expect(view.locator('.import-preview')).toContainText('Prüfkonflikt'); await view.getByLabel('Entscheidung Zeile 1').selectOption('exclude'); await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Fortsetzen (bis 100 Buchungen)' }).click(); await expect(view.getByText('Abgeschlossen · 1 / 1')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath('p5-import.png'), fullPage: true });
  });
  test('speichert Vorlage, Regeln und F14; ordnet Import ohne zweite Zahlung zu', async ({ page }, info) => {
    await prepare(page); const csv = 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1,00;Bank;Miete;42'; const view = await importPreview(page, csv, 'Meine Bank');
    await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await view.getByRole('button', { name: 'Fortsetzen (bis 100 Buchungen)' }).click(); await expect(view).toContainText('Abgeschlossen');
    await navigate(page, 'Regeln'); await page.getByRole('button', { name: 'Neue Regel', exact: true }).click(); await page.getByLabel('Bedingungswert').fill('Miete'); await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel P5' }); await page.getByRole('button', { name: 'Regel anlegen', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Regel deaktivieren' })).toBeVisible();
    await navigate(page, 'Dauerzahlungen'); await page.getByRole('button', { name: 'Neue Dauerzahlung', exact: true }).click(); await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Giro P5' }); await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel P5' }); await page.getByLabel('Dauerzahlungsbetrag').fill('-1,00'); await page.getByLabel('Erste Fälligkeit').fill('2028-01-31'); await page.getByLabel('Dauerzahlungsnotiz').fill('Miete P5'); await page.getByRole('button', { name: 'Dauerzahlung anlegen', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    const first = page.locator('.inline-form').filter({ has: page.getByText('Fällig: 31.01.2028', { exact: true }) }); await first.getByRole('combobox', { name: 'Importierte Zahlung' }).selectOption({ index: 1 }); await first.getByRole('button', { name: 'Import zuordnen' }).click(); await expect(page.getByText('Fällig: 31.01.2028')).toHaveCount(0);
    const feb = page.locator('.inline-form').filter({ has: page.getByText('Fällig: 29.02.2028', { exact: true }) }); await feb.getByRole('button', { name: 'Zahlung bestätigen' }).click(); await expect(page.getByText('Fällig: 29.02.2028')).toHaveCount(0); await page.getByRole('button', { name: 'Fälligkeit überspringen' }).click(); await expect(page.getByRole('button', { name: 'Zahlung bestätigen' })).toHaveCount(0);
    await navigate(page, 'Übersicht'); await expect(page.locator('.overview-hero')).toContainText(/-€\s*2,00/); await page.reload(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await navigate(page, 'Dauerzahlungen'); await expect(page.getByRole('button', { name: 'Zahlung bestätigen' })).toHaveCount(0); await navigate(page, 'Regeln'); await expect(page.getByRole('button', { name: 'Regel deaktivieren' })).toBeVisible();
    await navigate(page, 'Import'); const chooser = page.waitForEvent('filechooser'); await view.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'synthetisch.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await view.getByRole('combobox', { name: 'Vorlage', exact: true }).selectOption({ label: 'Meine Bank' }); await expect(view.getByLabel('Vorlagenname')).toHaveValue('Meine Bank'); await page.screenshot({ path: info.outputPath('p5-automation.png'), fullPage: true });
  });
});

test('verlangt eine Vorschauentscheidung auch für gleiche Zeilen derselben Datei', async ({ page }) => {
  await prepare(page);
  const view = await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1,00;Markt;Obst;\n31.01.2028;-1,00;Markt;Obst;');
  await expect(view.locator('.import-preview > li').nth(1)).toContainText('Mögliche Dublette');
  await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click();
  await expect(view.getByRole('status')).toContainText('ausdrückliche Entscheidung');
  await view.getByRole('button', { name: 'Zurück zur Vorschau' }).click(); await view.getByLabel('Entscheidung Zeile 2').selectOption('separate');
  await view.getByRole('button', { name: 'Übernahme prüfen' }).click(); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click();
  await view.getByRole('button', { name: 'Fortsetzen (bis 100 Buchungen)' }).click();
  await expect(view).toContainText('Abgeschlossen · 2 / 2');
});

test('aktualisiert fällige Vorschläge nach Tageswechsel ohne Änderungen an einem offenen Buchungsentwurf', async ({ page }) => {
  await prepare(page);
  await navigate(page, 'Dauerzahlungen'); await page.getByRole('button', { name: 'Neue Dauerzahlung', exact: true }).click();
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Giro P5' });
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel P5' });
  await page.getByLabel('Dauerzahlungsbetrag').fill('-1,00'); await page.getByLabel('Erste Fälligkeit').fill('2028-04-01'); await page.getByRole('button', { name: 'Dauerzahlung anlegen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText('Fällig: 01.04.2028', { exact: true })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2028-04-01T12:00:00Z')); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Fällig: 01.04.2028', { exact: true })).toBeVisible();
  await navigate(page, 'Buchungen'); await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Neue Buchung' });
  await expect(dialog.getByLabel('Datum', { exact: true })).toHaveValue('2028-04-01'); await dialog.getByLabel('Datum', { exact: true }).fill('2028-03-20');
  await page.clock.setFixedTime(new Date('2028-04-02T12:00:00Z')); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(dialog.getByLabel('Datum', { exact: true })).toHaveValue('2028-03-20');
});
