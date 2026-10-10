// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test, type Page } from '@playwright/test';
import { book, createCategory, createVault, details, saved, rows, readAggregates, unlock } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
async function prepare(page: Page) {
  await createVault(page); await createAccount(page, 'Girokonto'); await createAccount(page, 'Bargeld', '', 'cash'); await createCategory(page, 'Lebensmittel'); await createCategory(page, 'Haushalt', 'Haushaltskosten'); await createCategory(page, 'Freizeit', 'Freizeitkosten'); await navigate(page, 'Buchungen');
}
async function split(page: Page, note: string) {
  const dialog = await book(page, '-100', note); await dialog.getByText('Aufteilen', { exact: true }).click(); await dialog.getByRole('combobox', { name: 'Split-Kategorie (optional)' }).selectOption({ label: 'Haushalt' }); await dialog.getByLabel('Erster Splitbetrag').fill('60'); await dialog.getByLabel('Zweiter Splitbetrag').fill('40'); return dialog;
}
for (const touch of [false, true]) test.describe(touch ? 'Touch' : 'Tastatur', () => {
  test.use(touch ? { hasTouch: true, viewport: { width: 320, height: 568 } } : {});
  test('F02, dritte Zeile, normale und Splitbearbeitung sowie bestätigtes Löschen', async ({ page }, info) => {
    await prepare(page); let dialog = await split(page, 'F02'); await dialog.getByLabel('Zweiter Splitbetrag').fill('39'); const before = await readAggregates(page);
    const save = dialog.getByRole('button', { name: 'Lokal speichern' }); if (touch) await save.tap(); else { await save.focus(); await page.keyboard.press('Enter'); }
    await expect(dialog.getByRole('alert')).toContainText('Splitsumme'); expect(await readAggregates(page)).toEqual(before); await dialog.getByLabel('Zweiter Splitbetrag').fill('40'); await saved(page); await expect(rows(page)).toHaveCount(1);
    dialog = await details(page, 'F02'); await expect(dialog).toContainText(/-€\s*60,00/); await expect(dialog).toContainText(/-€\s*40,00/); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await dialog.getByLabel('Zweiter Splitbetrag').fill('-30'); await dialog.getByRole('button', { name: 'Split hinzufügen' }).click(); await dialog.getByRole('combobox', { name: 'Split-Kategorie 3', exact: true }).selectOption({ label: 'Freizeit' }); await dialog.getByLabel('Splitbetrag 3', { exact: true }).fill('-10'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog).toHaveCount(0);
    dialog = await details(page, 'F02'); await expect(dialog).toContainText('Freizeit'); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); await dialog.getByRole('button', { name: 'Split 3 entfernen' }).click(); await expect(dialog.getByLabel('Splitbetrag 3')).toHaveCount(0); const old = await readAggregates(page);
    await dialog.getByLabel('Zweiter Splitbetrag').fill('-39'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog.getByRole('alert')).toContainText('Splitsumme'); expect(await readAggregates(page)).toEqual(old); await dialog.getByLabel('Zweiter Splitbetrag').fill('-40'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog).toHaveCount(0);
    await book(page, '-20', 'Einzelbuchung'); await saved(page); dialog = await details(page, 'Einzelbuchung'); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); await dialog.getByLabel('Betrag', { exact: true }).fill('25'); await dialog.getByLabel('Notiz', { exact: true }).fill('Geänderte Einzelbuchung'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog).toHaveCount(0);
    dialog = await details(page, 'Geänderte Einzelbuchung'); await expect(dialog).toContainText(/-€\s*25,00/); await page.screenshot({ path: info.outputPath('buchungsdetails.png'), fullPage: true }); const beforeDelete = await readAggregates(page); await dialog.getByRole('button', { name: 'Löschen', exact: true }).click(); await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click(); expect(await readAggregates(page)).toEqual(beforeDelete);
    dialog = await details(page, 'Geänderte Einzelbuchung'); await dialog.getByRole('button', { name: 'Löschen', exact: true }).click(); await dialog.getByRole('button', { name: 'Löschen bestätigen' }).click(); await expect(rows(page)).toHaveCount(1); expect(JSON.stringify(await readAggregates(page))).toContain('deletedAt'); await navigate(page, 'Übersicht'); await expect(page.locator('.overview-hero')).toContainText(/-€\s*100,00/);
  });
});
test('kombiniert Konto, Zeitraum und Suche, zeigt Leerzustände und setzt alle Filter zurück', async ({ page }) => {
  await prepare(page); await expect(page.getByRole('heading', { name: 'Noch keine Buchungen' })).toBeVisible();
  for (const [note, account, date] of [['Einkauf heute', 'Girokonto', '2026-10-04'], ['Einkauf gestern', 'Girokonto', '2026-10-03'], ['Einkauf bar', 'Bargeld', '2026-10-04'], ['Freizeit', 'Girokonto', '2026-10-04']]) { const dialog = await book(page, '-10', note!, account!); await dialog.getByLabel('Datum', { exact: true }).fill(date!); await saved(page); }
  await page.getByLabel('Durchsuchen').fill('Einkauf'); await page.getByRole('button', { name: 'Filter', exact: true }).click(); await page.getByRole('combobox', { name: 'Kontofilter', exact: true }).selectOption({ label: 'Girokonto' }); await page.getByLabel('Von Datum').fill('2026-10-04'); await page.getByLabel('Bis Datum').fill('2026-10-04'); await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Einkauf heute');
  await page.getByLabel('Durchsuchen').fill('Unauffindbar'); await expect(page.getByRole('heading', { name: 'Keine passenden Buchungen' })).toBeVisible(); await page.getByRole('button', { name: 'Filter zurücksetzen' }).click(); await expect(rows(page)).toHaveCount(4);
});
test('bewahrt erfasste, geänderte, gesplittete und gelöschte Daten nach vollständigem Offline-Chromium-Neustart', async ({ baseURL }, info) => {
  test.setTimeout(90_000); const desktop = process.env.WIMM_CLIENT === 'desktop'; if (baseURL === undefined) throw new Error('Clientadresse fehlt'); const launch = () => chromium.launchPersistentContext(info.outputPath('offline-profil'), { channel: 'chromium-headless-shell', headless: true, baseURL }); let context = await launch();
  try {
    let page = await context.newPage(); await prepare(page); await split(page, 'Dauerhafter Split'); await saved(page); await book(page, '-20', 'Ändern'); await saved(page); let dialog = await details(page, 'Ändern'); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); await dialog.getByLabel('Betrag', { exact: true }).fill('25'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog).toHaveCount(0);
    await book(page, '-30', 'Gelöscht'); await saved(page); dialog = await details(page, 'Gelöscht'); await dialog.getByRole('button', { name: 'Löschen', exact: true }).click(); await dialog.getByRole('button', { name: 'Löschen bestätigen' }).click(); await expect(rows(page)).toHaveCount(2); const before = await readAggregates(page);
    if (!desktop) { await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true); }
    await context.close(); context = await launch(); if (!desktop) await context.setOffline(true); page = await context.newPage(); const response = await page.goto('/'); if (!desktop) expect(response?.fromServiceWorker()).toBe(true); await expect(page.locator('.app-shell')).toHaveCount(0); await unlock(page); if (desktop) {
      // Der Browser-Frontendmodus hat keinen Tauri-Bundlepfad oder PWA-Service-Worker.
      // Tatsächliche Rust-Workerinitialisierung vor der bisherigen Offline-Umschaltung abschließen.
      await expect(page.locator('.overview-hero')).toContainText(/-€\s*125,00/);
      expect(await readAggregates(page)).toEqual(before);
      await context.setOffline(true);
    }
    await expect(page.locator('.overview-hero')).toContainText(/-€\s*125,00/); await navigate(page, 'Buchungen'); await expect(rows(page)).toHaveCount(2); expect(await readAggregates(page)).toEqual(before); dialog = await details(page, 'Dauerhafter Split'); await expect(dialog).toContainText(/-€\s*60,00/); await expect(dialog).toContainText(/-€\s*40,00/);
  } finally { await context.close(); }
});
