// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test, type Page, type Locator } from '@playwright/test';
import type { TransactionAggregate } from '../../packages/domain/src/index.js';
import { navigate, openAccountAction, openBooking } from '../helpers/ui.js';
const rows = (page: Page) => page.locator('[data-transaction-id]');
const read = (page: Page) => page.evaluate(() => window.workspaceTest.read());
const live = async (page: Page) => (await read(page)).filter((entry) => entry.aggregateType === 'transaction' && entry.deletedAt === undefined) as unknown as TransactionAggregate[];
async function open(page: Page, desktop: boolean) { await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z')); await page.goto(`/tests/workspace.html?p44=true&desktop=${desktop}`); await navigate(page, 'Konten'); }
async function activate(page: Page, button: Locator, touch: boolean) {
  await expect(button).toBeEnabled();
  if (touch) return button.tap();
  for (let i = 0; i < 150; i += 1) { if (await button.evaluate((element) => element === document.activeElement)) { await page.keyboard.press('Enter'); return; } await page.keyboard.press('Tab'); }
  throw new Error('Befehl per Tastatur nicht erreichbar');
}
async function transfer(page: Page, source = 'Testkonto', target = 'Zielkonto', amount = '200') {
  const form = await openAccountAction(page, source, 'Umbuchen');
  await form.getByLabel('Von', { exact: true }).selectOption({ label: source }); await form.getByLabel('Nach', { exact: true }).selectOption({ label: target });
  await form.getByLabel('Umbuchungsbetrag').fill(amount); await form.getByLabel('Umbuchungsdatum').fill('2026-10-05'); return form;
}
async function reconcile(page: Page, balance = '800', account = 'Testkonto') {
  const form = await openAccountAction(page, account, 'Abgleichen');
  await form.getByLabel('Abgleichkonto').selectOption({ label: account }); await form.getByLabel('Auszugssaldo').fill(balance); await form.getByLabel('Auszugsdatum').fill('2026-10-05');
  await form.getByRole('button', { name: 'Buchungen auswählen', exact: true }).click(); const boxes = form.getByRole('checkbox'); for (let i = 0; i < await boxes.count(); i += 1) await boxes.nth(i).check(); await form.getByRole('button', { name: 'Abgleich prüfen' }).click(); return form;
}
async function view(page: Page, name: string) { await navigate(page, name); if (name === 'Konten' && await page.getByRole('button', { name: 'Zurück zu Konten' }).isVisible()) await page.getByRole('button', { name: 'Zurück zu Konten' }).click(); }
async function detail(page: Page, account = 'Testkonto', amount = /200,00/) {
  await view(page, 'Buchungen'); const row = rows(page).filter({ hasText: account }).filter({ hasText: amount }); await row.getByRole('button', { name: /^Details:/ }).click(); return page.getByRole('dialog', { name: 'Buchungsdetails', exact: true });
}
for (const touch of [false, true]) {
  test.describe(touch ? 'Touch' : 'Tastatur', () => {
    test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
    test('F03 und Budgetgrenzen, Auswahlabgleich, Abbruch/Entsperrung und Transferpflege', async ({ page }, info) => {
      await open(page, info.project.name.startsWith('Desktop'));
      let form = await transfer(page); await activate(page, form.getByRole('button', { name: 'Umbuchung speichern' }), touch);
      await expect(form).toHaveCount(0); await view(page, 'Konten');
      await expect(page.getByRole('row').filter({ hasText: 'Testkonto' })).toContainText(/800,00/); await expect(page.getByRole('row').filter({ hasText: 'Zielkonto' })).toContainText(/200,00/);
      await page.screenshot({ path: info.outputPath('f03-konten.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await view(page, 'Übersicht'); await expect(page.locator('.overview-hero')).toContainText(/1.000,00/); await expect(page.locator('.overview-grid article').filter({ hasText: 'Monatsausgaben' })).toContainText(/0,00/); await expect(page.locator('.overview-grid article').filter({ hasText: 'Monatseinnahmen' })).toContainText(/0,00/);
      await view(page, 'Konten'); form = await transfer(page, 'Testkonto', 'Extern', '10'); await activate(page, form.getByRole('button', { name: 'Umbuchung speichern' }), touch); expect(await live(page)).toHaveLength(3);
      await expect(form.getByLabel('Budgetkategorie')).toBeVisible(); await form.getByLabel('Budgetkategorie').selectOption({ label: 'Testkategorie' }); await activate(page, form.getByRole('button', { name: 'Umbuchung speichern' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      form = await transfer(page, 'Extern', 'Testkonto', '10'); await activate(page, form.getByRole('button', { name: 'Umbuchung speichern' }), touch); expect(await live(page)).toHaveLength(5);
      await form.getByLabel('Vorhandenes Geld für das Budget freigeben').check(); await activate(page, form.getByRole('button', { name: 'Umbuchung speichern' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      // Eigene Referenzangaben nach Commit sind sauber und erlauben Navigation.
      await view(page, 'Buchungen'); await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toHaveCount(0); await view(page, 'Konten');
      form = await reconcile(page, '800');
      await form.getByRole('button', { name: 'Zurück', exact: true }).click(); const checkbox = form.getByRole('checkbox').first(); await checkbox.uncheck(); await form.getByRole('button', { name: 'Abgleich prüfen' }).click(); await expect(form.getByRole('button', { name: 'Abgleich bestätigen' })).toBeDisabled();
      const before = await read(page); await expect(form).toContainText('Differenz:'); expect(await read(page)).toEqual(before); await form.getByRole('button', { name: 'Zurück', exact: true }).click(); await checkbox.check(); await form.getByRole('button', { name: 'Abgleich prüfen' }).click();
      await activate(page, form.getByRole('button', { name: 'Abgleich bestätigen' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      expect((await live(page)).filter((entry) => entry.accountId.endsWith('003')).every((entry) => entry.clearance === 'reconciled')).toBe(true);
      let dialog = await detail(page); await expect(dialog.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Abgleich entsperren', exact: true }).click(); const locked = await read(page); await activate(page, page.getByRole('dialog').last().getByRole('button', { name: 'Abbrechen' }), touch); expect(await read(page)).toEqual(locked);
      dialog = await detail(page); await dialog.getByRole('button', { name: 'Abgleich entsperren', exact: true }).click(); await activate(page, page.getByRole('dialog').getByRole('button', { name: 'Entsperren bestätigen' }), touch); await expect(page.getByRole('dialog')).toHaveCount(0);
      const pair = (await live(page)).filter((entry) => Math.abs(entry.amount) === 20000); expect(pair.map((entry) => entry.clearance).sort()).toEqual(['cleared', 'uncleared']);
      dialog = await detail(page); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); const editor = page.getByRole('dialog'); await editor.getByLabel('Umbuchungsbetrag').fill('250'); await activate(page, editor.getByRole('button', { name: 'Umbuchung ändern' }), touch); await expect(editor).toHaveCount(0);
      expect((await live(page)).filter((entry) => Math.abs(entry.amount) === 25000)).toHaveLength(2);
      await page.screenshot({ path: info.outputPath('transfer-buchungen.png'), fullPage: true });
    });
    test('Differenz legt erst nach gesonderter Bestätigung eine Korrektur an, neuer Abgleich berücksichtigt Ausgangssaldo', async ({ page }, info) => {
      await open(page, info.project.name.startsWith('Desktop')); let form = await reconcile(page, '999'); await expect(form).toContainText(/-€\s*1,00/); await expect(form.getByRole('button', { name: 'Abgleich bestätigen' })).toBeDisabled();
      const before = await read(page); await activate(page, form.getByRole('button', { name: 'Korrektur vorschlagen' }), touch); await expect(page.getByRole('dialog').last()).toContainText(/-€\s*1,00/); await activate(page, page.getByRole('dialog').last().getByRole('button', { name: 'Abbrechen' }), touch); expect(await read(page)).toEqual(before);
      await activate(page, form.getByRole('button', { name: 'Korrektur vorschlagen' }), touch); await page.getByRole('dialog').getByLabel('Korrekturkategorie').selectOption({ label: 'Testkategorie' }); await activate(page, page.getByRole('dialog').getByRole('button', { name: 'Korrekturbuchung anlegen' }), touch); await expect(page.getByRole('dialog', { name: 'Korrekturbuchung bestätigen?' })).toHaveCount(0);
      const correction = (await live(page)).find((entry) => entry.note === 'Korrektur zum Kontoauszug')!; expect(correction).toMatchObject({ amount: -100, date: '2026-10-05', clearance: 'uncleared' });
      await form.getByRole('checkbox').last().check(); await form.getByRole('button', { name: 'Abgleich prüfen' }).click(); await expect(form).toContainText(/Differenz: €\s*0,00/); await activate(page, form.getByRole('button', { name: 'Abgleich bestätigen' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      await transfer(page, 'Testkonto', 'Zielkonto', '99'); await page.getByRole('button', { name: 'Umbuchung speichern' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
      form = await reconcile(page, '900'); await expect(form).toContainText(/Differenz: €\s*0,00/); await activate(page, form.getByRole('button', { name: 'Abgleich bestätigen' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      const saved = await read(page); await page.reload(); await view(page, 'Konten'); expect(await read(page)).toEqual(saved); await expect(page.getByRole('row').filter({ hasText: 'Testkonto' })).toContainText(/900,00/);
    });
    test('Normale abgeglichene Buchung bleibt bis zur bestätigten Entsperrung gesperrt und ist danach bearbeitbar', async ({ page }, info) => {
      await open(page, info.project.name.startsWith('Desktop')); await view(page, 'Buchungen');
      const booking = await openBooking(page); await booking.locator('summary').filter({ hasText: /^Notiz$/ }).click(); await booking.getByLabel('Betrag', { exact: true }).fill('-10'); await booking.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' }); await booking.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' }); await booking.getByLabel('Notiz').fill('Abgeglichener Einkauf'); await booking.getByLabel('Datum', { exact: true }).fill('2026-10-05');
      await activate(page, booking.getByRole('button', { name: 'Lokal speichern' }), touch); await expect(booking).toHaveCount(0);
      await view(page, 'Konten'); const form = await reconcile(page, '990'); await activate(page, form.getByRole('button', { name: 'Abgleich bestätigen' }), touch); await expect(form).toHaveCount(0); await view(page, 'Konten');
      let dialog = await detail(page, 'Testkonto', /Abgeglichener Einkauf/); await expect(dialog.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
      await activate(page, dialog.getByRole('button', { name: 'Abgleich entsperren', exact: true }), touch); const before = await read(page); await page.keyboard.press('Escape'); expect(await read(page)).toEqual(before);
      dialog = await detail(page, 'Testkonto', /Abgeglichener Einkauf/); await activate(page, dialog.getByRole('button', { name: 'Abgleich entsperren', exact: true }), touch); await activate(page, page.getByRole('dialog').getByRole('button', { name: 'Entsperren bestätigen' }), touch); await expect(page.getByRole('dialog')).toHaveCount(0);
      dialog = await detail(page, 'Testkonto', /Abgeglichener Einkauf/); await activate(page, dialog.getByRole('button', { name: 'Bearbeiten', exact: true }), touch); const editor = page.getByRole('dialog'); await editor.getByLabel('Betrag', { exact: true }).fill('-15'); await activate(page, editor.getByRole('button', { name: 'Änderung speichern' }), touch); await expect(editor).toHaveCount(0);
      expect((await live(page)).find((entry) => entry.note === 'Abgeglichener Einkauf')).toMatchObject({ amount: -1500, clearance: 'cleared' });
    });
    test('Buchung nach dem Auszugsdatum bleibt vom Abgleich ausgeschlossen', async ({ page }, info) => {
      await open(page, info.project.name.startsWith('Desktop'));
      await view(page, 'Buchungen');
      const booking = await openBooking(page);
      await booking.locator('summary').filter({ hasText: /^Notiz$/ }).click();
      await booking.getByLabel('Betrag', { exact: true }).fill('-10');
      await booking.getByLabel('Datum', { exact: true }).fill('2026-10-06');
      await booking.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' });
      await booking.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' });
      await booking.getByLabel('Notiz').fill('Künftiger Einkauf');
      await activate(page, booking.getByRole('button', { name: 'Lokal speichern' }), touch);
      await expect(booking).toHaveCount(0);
      const before = await read(page);
      await view(page, 'Konten');
      const form = await reconcile(page, '990');
      await expect(form).toContainText(/Differenz: -€\s*10,00/);
      await expect(form.getByRole('button', { name: 'Abgleich bestätigen' })).toBeDisabled();
      await form.getByRole('button', { name: 'Zurück', exact: true }).click();
      await expect(form.getByRole('checkbox')).toHaveCount(1);
      await expect(form).not.toContainText('Künftiger Einkauf');
      expect(await read(page)).toEqual(before);
      expect((await live(page)).find((entry) => entry.note === 'Künftiger Einkauf')).toMatchObject({ date: '2026-10-06', clearance: 'uncleared' });
    });
    test('Schützt geänderte Buchungs-, Transfer- und Abgleichdialoge mit Escape, Abbrechen und Fokus', async ({ page }, info) => {
      await open(page, info.project.name.startsWith('Desktop'));
      for (const action of ['transfer', 'reconcile', 'booking'] as const) {
        const form = action === 'transfer' ? await transfer(page) : action === 'reconcile' ? await reconcile(page, '999') : await openBooking(page);
        if (action === 'booking') await form.getByLabel('Betrag', { exact: true }).fill('-10');
        const before = await read(page); await page.keyboard.press('Escape');
        const prompt = page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' });
        await expect(prompt).toBeVisible(); await activate(page, prompt.getByRole('button', { name: 'Weiter bearbeiten' }), touch);
        await expect(form).toBeVisible(); expect(await read(page)).toEqual(before);
        await page.keyboard.press('Escape'); await activate(page, prompt.getByRole('button', { name: 'Eingaben verwerfen' }), touch);
        await expect(page.getByRole('dialog')).toHaveCount(0); expect(await read(page)).toEqual(before);
      }
      const dialog = await detail(page, 'Testkonto', /Anfangsbestand/); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Buchung bearbeiten', exact: true }); await editor.getByLabel('Betrag', { exact: true }).fill('900');
      await editor.getByRole('button', { name: 'Abbrechen' }).click(); const prompt = page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' });
      await prompt.getByRole('button', { name: 'Weiter bearbeiten' }).click(); await expect(editor.getByLabel('Betrag', { exact: true })).toHaveValue('900');
      await page.keyboard.press('Escape'); await prompt.getByRole('button', { name: 'Eingaben verwerfen' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
}
test('Transfer- und Entsperrfehler rollen auch zuvor geschriebene Zeilen zurück; Undo/Redo überschreibt keine Fremdänderung', async ({ page }, info) => {
  await open(page, info.project.name.startsWith('Desktop')); const form = await transfer(page); let before = await read(page); await page.evaluate(() => window.workspaceTest.mode('partial'));
  await form.getByRole('button', { name: 'Umbuchung speichern' }).click(); await expect(form.locator('..').getByRole('alert')).toBeVisible(); expect(await read(page)).toEqual(before); await expect(form.getByLabel('Umbuchungsbetrag')).toHaveValue('200');
  await page.evaluate(() => window.workspaceTest.mode('normal')); await form.getByRole('button', { name: 'Umbuchung speichern' }).click(); await expect(form).toHaveCount(0); await view(page, 'Konten');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click(); await expect.poll(async () => (await live(page)).length).toBe(1);
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click(); await expect.poll(async () => (await live(page)).length).toBe(3);
  let reconciliation = await reconcile(page); await reconciliation.getByRole('button', { name: 'Abgleich bestätigen' }).click(); await expect(reconciliation).toHaveCount(0);
  let dialog = await detail(page); await dialog.getByRole('button', { name: 'Abgleich entsperren', exact: true }).click(); before = await read(page); await page.evaluate(() => window.workspaceTest.mode('partial')); await page.getByRole('dialog').getByRole('button', { name: 'Entsperren bestätigen' }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible(); expect(await read(page)).toEqual(before);
  await page.evaluate(() => window.workspaceTest.mode('normal')); await page.getByRole('dialog').getByRole('button', { name: 'Entsperren bestätigen' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click(); await expect.poll(async () => (await live(page)).filter((entry) => entry.clearance === 'reconciled').length).toBe(2);
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click(); await expect.poll(async () => (await live(page)).filter((entry) => entry.clearance === 'reconciled').length).toBe(0);
  const source = (await live(page)).find((entry) => entry.kind === 'transfer' && entry.amount < 0)!; await page.evaluate((id) => window.workspaceTest.stale(id), source.id); before = await read(page);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click(); await expect(page.getByText(/revision|aktuell|inzwischen/i)).toBeVisible(); expect(await read(page)).toEqual(before);
});
test('Abgleichauswahl und Saldo bleiben nach echtem Chromium-Neustart erhalten', async ({ baseURL }, info) => {
  if (baseURL === undefined) throw new Error('Clientadresse fehlt');
  const launch = () => chromium.launchPersistentContext(info.outputPath('abgleich-profil'), { channel: 'chromium-headless-shell', headless: true, baseURL });
  let context = await launch();
  try {
    let page = await context.newPage(); await open(page, info.project.name.startsWith('Desktop')); await transfer(page); await page.getByRole('button', { name: 'Umbuchung speichern' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    const form = await reconcile(page, '-200'); await form.getByRole('button', { name: 'Zurück', exact: true }).click(); await form.getByRole('checkbox').first().uncheck(); await form.getByRole('button', { name: 'Abgleich prüfen' }).click(); await form.getByRole('button', { name: 'Abgleich bestätigen' }).click(); await expect(form).toHaveCount(0); await view(page, 'Konten');
    const before = await read(page); await context.close(); context = await launch(); page = await context.newPage(); await open(page, info.project.name.startsWith('Desktop')); expect(await read(page)).toEqual(before);
    const transactions = await live(page); expect(transactions.filter((entry) => entry.clearance === 'reconciled')).toHaveLength(1); expect(transactions.find((entry) => entry.kind === 'opening')?.clearance).toBe('uncleared'); await expect(page.getByRole('row').filter({ hasText: 'Testkonto' })).toContainText(/800,00/);
  } finally { await context.close(); }
});
test('Redo lehnt Fremdänderung ab und eine neue Buchung verwirft den Redozweig', async ({ page }, info) => {
  await open(page, info.project.name.startsWith('Desktop')); await transfer(page); await page.getByRole('button', { name: 'Umbuchung speichern' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click(); await expect.poll(async () => (await live(page)).length).toBe(1);
  const tombstone = (await read(page)).find((entry) => entry.aggregateType === 'transaction' && entry.deletedAt !== undefined)!; await page.evaluate((id) => window.workspaceTest.stale(id), tombstone.id); const before = await read(page);
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click(); await expect(page.getByText(/revision|aktuell|inzwischen/i)).toBeVisible(); expect(await read(page)).toEqual(before);
  await view(page, 'Buchungen'); const form = await openBooking(page); await form.getByLabel('Betrag', { exact: true }).fill('-1'); await form.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' }); await form.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' }); await form.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Wiederholen', exact: true })).toBeDisabled();
});

test('Gespeicherte Transfer- und Abgleichformulare sind vor dem nächsten Animationsframe sauber', async ({ page }, info) => {
  // Ein pausierter Renderframe darf keine Rückfrage nach bestätigtem Commit erzeugen.
  await page.addInitScript(() => { window.requestAnimationFrame = () => 1; });
  await open(page, info.project.name.startsWith('Desktop'));
  const transferForm = await transfer(page);
  await transferForm.getByRole('button', { name: 'Umbuchung speichern' }).click();
  await expect(transferForm).toHaveCount(0);
  await view(page, 'Buchungen');
  await expect(page.getByRole('heading', { name: 'Buchungen', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toHaveCount(0);
  await view(page, 'Konten');
  const reconciliation = await reconcile(page, '800');
  await reconciliation.getByRole('button', { name: 'Abgleich bestätigen' }).click();
  await expect(reconciliation).toHaveCount(0);
  await view(page, 'Buchungen');
  await expect(page.getByRole('heading', { name: 'Buchungen', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' })).toHaveCount(0);
});
