// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test, type Page, type Locator } from '@playwright/test';
const passphrase = 'p4-3-gesamt-passphrase-2026';
const rows = (page: Page) => page.locator('tr[data-transaction-id]');

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await unlock(page);
  await page.getByRole('button', { name: 'Konten', exact: true }).click();
  for (const name of ['Girokonto', 'Bargeld']) {
    await page.getByLabel('Kontoname').fill(name);
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
  await page.getByLabel('Neue Kategoriegruppe').fill('Alltag');
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
  await expect(page.getByLabel('Neue Kategoriegruppe')).toHaveValue('');
  await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: 'Alltag' });
  for (const name of ['Lebensmittel', 'Haushalt', 'Freizeit']) {
    await page.getByLabel('Kategorie', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
}
async function unlock(page: Page) {
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
}
async function booking(page: Page, amount: string, note: string, account = 'Girokonto', date = '2026-10-04') {
  const form = page.getByRole('form', { name: 'Buchung erfassen', exact: true });
  await form.getByLabel('Betrag', { exact: true }).fill(amount);
  await form.getByLabel('Datum', { exact: true }).fill(date);
  await form.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
  await form.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Lebensmittel' });
  await form.getByLabel('Notiz').fill(note);
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((entry) => entry.name?.startsWith('wimm-ui-'))?.name;
    if (!name) throw new Error('Testdatenbank fehlt');
    return await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const query = database.transaction('aggregates').objectStore('aggregates').getAll();
        query.onerror = () => { database.close(); reject(query.error); };
        query.onsuccess = () => { database.close(); resolve(query.result.map((row: { payload: unknown }) => row.payload)); };
      };
    });
  });
}
async function activate(page: Page, locator: Locator, touch: boolean) {
  if (touch) { await locator.tap(); return; }
  for (let index = 0; index < 120; index += 1) {
    if (await locator.evaluate((element) => document.activeElement === element)) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error('Aktion per Tabulator nicht erreichbar');
}

for (const touch of [false, true]) {
  test.describe(touch ? 'Touch' : 'Tastatur', () => {
    test.use(touch ? { hasTouch: true, viewport: { width: 320, height: 568 } } : {});
    test('F02, dritte Zeile, normale und Splitbearbeitung sowie bestätigtes Löschen', async ({ page }, info) => {
      await prepare(page);
      await booking(page, '-100', 'F02');
      await page.getByRole('combobox', { name: 'Split-Kategorie (optional)', exact: true }).selectOption({ label: 'Haushalt' });
      await page.getByLabel('Erster Splitbetrag').fill('-60');
      await page.getByLabel('Zweiter Splitbetrag').fill('-39');
      const before = await snapshot(page);
      await activate(page, page.getByRole('button', { name: 'Lokal speichern' }), touch);
      await expect(page.getByRole('alert')).toContainText('Splitsumme');
      expect(await snapshot(page)).toEqual(before);
      await page.getByLabel('Zweiter Splitbetrag').fill('-40');
      await activate(page, page.getByRole('button', { name: 'Lokal speichern' }), touch);
      await expect(rows(page)).toHaveCount(1);
      await rows(page).getByRole('button', { name: 'Details' }).click();
      let dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/-€\s*60,00/);
      await expect(dialog).toContainText(/-€\s*40,00/);
      await activate(page, dialog.getByRole('button', { name: 'Bearbeiten', exact: true }), touch);
      await dialog.getByLabel('Zweiter Splitbetrag').fill('-30');
      await dialog.getByRole('button', { name: 'Split hinzufügen' }).click();
      await dialog.getByRole('combobox', { name: 'Split-Kategorie 3', exact: true }).selectOption({ label: 'Freizeit' });
      await dialog.getByLabel('Splitbetrag 3', { exact: true }).fill('-10');
      await activate(page, dialog.getByRole('button', { name: 'Änderung speichern' }), touch);
      await expect(dialog).toHaveCount(0);
      await expect(rows(page)).toHaveCount(1);
      await rows(page).getByRole('button', { name: 'Details' }).click();
      await expect(dialog).toContainText('Freizeit');
      await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      await dialog.getByRole('button', { name: 'Split 3 entfernen' }).click();
      await expect(dialog.getByLabel('Splitbetrag 3', { exact: true })).toHaveCount(0);
      const savedSplit = await snapshot(page);
      await dialog.getByLabel('Zweiter Splitbetrag').fill('-39');
      await activate(page, dialog.getByRole('button', { name: 'Änderung speichern' }), touch);
      await expect(dialog.getByRole('alert')).toContainText('Splitsumme');
      await expect(dialog.getByLabel('Zweiter Splitbetrag')).toHaveValue('-39');
      expect(await snapshot(page)).toEqual(savedSplit);
      await dialog.getByLabel('Zweiter Splitbetrag').fill('-40');
      await activate(page, dialog.getByRole('button', { name: 'Änderung speichern' }), touch);
      await expect(dialog).toHaveCount(0);
      await booking(page, '-20', 'Einzelbuchung');
      await activate(page, page.getByRole('button', { name: 'Lokal speichern' }), touch);
      await expect(rows(page)).toHaveCount(2);
      await rows(page).filter({ hasText: 'Einzelbuchung' }).getByRole('button', { name: 'Details' }).click();
      await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      await dialog.getByLabel('Betrag', { exact: true }).fill('-25');
      await dialog.getByLabel('Notiz').fill('Geänderte Einzelbuchung');
      await activate(page, dialog.getByRole('button', { name: 'Änderung speichern' }), touch);
      await expect(rows(page)).toHaveCount(2);
      await rows(page).filter({ hasText: 'Geänderte Einzelbuchung' }).getByRole('button', { name: 'Details' }).click();
      await expect(dialog).toContainText(/-€\s*25,00/);
      await page.screenshot({ path: info.outputPath('buchungsdetails.png'), fullPage: true });
      const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(touch ? 320 : 1280);
      const beforeDelete = await snapshot(page);
      await dialog.getByRole('button', { name: 'Löschen', exact: true }).click();
      await activate(page, dialog.getByRole('button', { name: 'Abbrechen' }), touch);
      expect(await snapshot(page)).toEqual(beforeDelete);
      await expect(rows(page)).toHaveCount(2);
      await rows(page).filter({ hasText: 'Geänderte Einzelbuchung' }).getByRole('button', { name: 'Details' }).click();
      dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Löschen', exact: true }).click();
      await activate(page, dialog.getByRole('button', { name: 'Löschen bestätigen' }), touch);
      await expect(rows(page)).toHaveCount(1);
      expect(JSON.stringify(await snapshot(page))).toContain('deletedAt');
      await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
      await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText(/-€\s*100,00/);
    });
  });
}

test('kombiniert Konto, Zeitraum und Suche, zeigt Leerzustände und setzt alle Filter zurück', async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole('heading', { name: 'Noch keine Buchungen' })).toBeVisible();
  for (const [note, account, date] of [['Einkauf heute', 'Girokonto', '2026-10-04'], ['Einkauf gestern', 'Girokonto', '2026-10-03'], ['Einkauf bar', 'Bargeld', '2026-10-04'], ['Freizeit', 'Girokonto', '2026-10-04']]) {
    await booking(page, '-10', note!, account!, date!);
    await page.getByRole('button', { name: 'Lokal speichern' }).click();
    await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('');
  }
  await page.getByLabel('Durchsuchen').fill('Einkauf');
  await page.getByRole('combobox', { name: 'Kontofilter', exact: true }).selectOption({ label: 'Girokonto' });
  await page.getByLabel('Von Datum').fill('2026-10-04');
  await page.getByLabel('Bis Datum').fill('2026-10-04');
  await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Einkauf heute');
  await page.getByLabel('Durchsuchen').fill('Unauffindbar');
  await expect(page.getByRole('heading', { name: 'Keine passenden Buchungen' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(rows(page)).toHaveCount(4);
});

test('bewahrt erfasste, geänderte, gesplittete und gelöschte Daten nach vollständigem Offline-Chromium-Neustart', async ({ baseURL }, info) => {
  test.setTimeout(90_000);
  if (baseURL === undefined) throw new Error('Die Clientadresse fehlt.');
  const desktop = process.env.WIMM_CLIENT === 'desktop';
  const launch = () => chromium.launchPersistentContext(info.outputPath('offline-profil'), { channel: 'chromium-headless-shell', headless: true, baseURL });
  let context = await launch();
  try {
    const page = await context.newPage(); await prepare(page);
    await booking(page, '-100', 'Dauerhafter Split');
    await page.getByRole('combobox', { name: 'Split-Kategorie (optional)', exact: true }).selectOption({ label: 'Haushalt' });
    await page.getByLabel('Erster Splitbetrag').fill('-60'); await page.getByLabel('Zweiter Splitbetrag').fill('-40');
    await page.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(rows(page)).toHaveCount(1);
    await booking(page, '-20', 'Ändern'); await page.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(rows(page)).toHaveCount(2);
    await rows(page).filter({ hasText: 'Ändern' }).getByRole('button', { name: 'Details' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Betrag', { exact: true }).fill('-25');
    await page.getByRole('dialog').getByRole('button', { name: 'Änderung speichern' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await booking(page, '-30', 'Gelöscht'); await page.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(rows(page)).toHaveCount(3);
    await rows(page).filter({ hasText: 'Gelöscht' }).getByRole('button', { name: 'Details' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen bestätigen' }).click(); await expect(rows(page)).toHaveCount(2);
    const before = await snapshot(page);
    if (!desktop) {
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload();
      await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    }
    await context.close(); context = await launch();
    if (!desktop) await context.setOffline(true);
    // Desktop-Frontend prüft denselben dauerhaften Datenstand im Browseradapter.
    // Sein Assetserver ist kein installierter Desktopclient; native Wiederholung P4.6.6.
    const restarted = await context.newPage(); const response = await restarted.goto('/'); expect(response?.status()).toBe(200);
    if (!desktop) expect(response?.fromServiceWorker()).toBe(true);
    await expect(restarted.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
    await expect(restarted.getByRole('region', { name: 'Buchungsliste' })).toHaveCount(0);
    await unlock(restarted);
    if (desktop) await context.setOffline(true);
    await expect(restarted.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText(/-€\s*125,00/);
    await restarted.getByRole('button', { name: 'Buchungen', exact: true }).click(); await expect(rows(restarted)).toHaveCount(2);
    expect(await snapshot(restarted)).toEqual(before);
    await rows(restarted).filter({ hasText: 'Dauerhafter Split' }).getByRole('button', { name: 'Details' }).click();
    await expect(restarted.getByRole('dialog')).toContainText(/-€\s*60,00/); await expect(restarted.getByRole('dialog')).toContainText(/-€\s*40,00/);
  } finally { await context.close(); }
});
