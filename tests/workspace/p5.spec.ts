// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
async function select(page: Page, data: string) {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const view = page.getByRole('region', { name: 'Dateiimport' });
  await view.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' }); await view.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' });
  const chooser = page.waitForEvent('filechooser'); await view.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'p5-grossimport.csv', mimeType: 'text/csv', buffer: Buffer.from(data) });
  await view.getByRole('button', { name: 'Vorschau erstellen' }).click(); await expect(view.getByRole('status')).toContainText('Zeilen in der Vorschau'); await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await expect(view.getByRole('status')).toContainText('Importentscheidungen gespeichert'); return view;
}
const csv = (count: number) => 'Datum;Betrag;Empfänger;Notiz;ID\n' + Array.from({ length: count }, (_, i) => `05.10.2026;-1,00;Bäckerei;Öl ${i};id-${i}`).join('\n');
test('pausiert nach Gruppe und nimmt nach echtem Prozessneustart ohne Doppelbuchung wieder auf', async ({ baseURL }, info) => {
  const root = resolve('.toolchain-checks'); mkdirSync(root, { recursive: true }); const profile = mkdtempSync(resolve(root, 'p5-wiederaufnahme-'));
  const url = `/tests/workspace.html?count=0&desktop=${info.project.name.startsWith('Desktop')}`;
  let context = await chromium.launchPersistentContext(profile, { baseURL: baseURL!, timeout: 15000 });
  try {
    
    let page = context.pages()[0]!; await page.goto(url); let view = await select(page, csv(205)); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Teilweise übernommen · 100 / 205');
    expect((await page.evaluate(() => window.workspaceTest.read())).filter(a => a.aggregateType === 'transaction')).toHaveLength(100);
    await context.close(); context = await chromium.launchPersistentContext(profile, { baseURL: baseURL!, timeout: 15000 }); page = context.pages()[0]!; await page.goto(url); await page.getByRole('button', { name: 'Import', exact: true }).click(); view = page.getByRole('region', { name: 'Dateiimport' }); await expect(view).toContainText('Teilweise übernommen · 100 / 205');
    for (const mode of ['quota', 'disk', 'partial']) {
      const before = await page.evaluate(() => window.workspaceTest.read()); await page.evaluate(value => window.workspaceTest.mode(value), mode); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view.getByRole('status')).toContainText('Gruppe wurde nicht gespeichert'); expect(await page.evaluate(() => window.workspaceTest.read())).toEqual(before);
    }
    await page.evaluate(() => window.workspaceTest.mode('normal')); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Teilweise übernommen · 200 / 205'); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Abgeschlossen · 205 / 205');
    const all = await page.evaluate(() => window.workspaceTest.read()); const transactions = all.filter(a => a.aggregateType === 'transaction'); expect(transactions).toHaveLength(205); expect(new Set(transactions.map(t => (t as unknown as { importReference: string }).importReference)).size).toBe(205);
    await page.screenshot({ path: info.outputPath('p5-wiederaufnahme.png'), fullPage: true, timeout: 5000 });
  } finally { await context.close(); }
});
test('bereitet Großimport im Worker vor, bleibt bedienbar und bewahrt Fortschritt bei pausiertem Commit', async ({ page }, info) => {
  await page.goto(`/tests/workspace.html?count=0&desktop=${info.project.name.startsWith('Desktop')}`);
  const view = await select(page, csv(99999)); await expect(view).toContainText('Bereit · 0 / 99999');
  // Der echte Browser kann während Gruppenvorbereitung/Write Eingaben verarbeiten.
  await page.evaluate(() => { window.workspaceTest.mode('delay'); (window as unknown as { p5Ticks: number }).p5Ticks = 0; const timer = setInterval(() => { (window as unknown as { p5Ticks: number }).p5Ticks++; }, 10); setTimeout(() => clearInterval(timer), 2000); });
  await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(page.getByText('Wird lokal gespeichert …')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { p5Ticks: number }).p5Ticks)).toBeGreaterThan(5);
  await page.evaluate(() => window.workspaceTest.release()); await expect(view).toContainText('Teilweise übernommen · 100 / 99999');
  expect((await page.evaluate(() => window.workspaceTest.read())).filter(a => a.aggregateType === 'transaction')).toHaveLength(100);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  for (const colorScheme of ['light', 'dark'] as const) test(`Import-/Automatisierungsansichten ${viewport.width} ${colorScheme}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ colorScheme }); await page.goto(`/tests/workspace.html?count=0&desktop=${info.project.name.startsWith('Desktop')}`);
    await page.getByRole('button', { name: 'Import', exact: true }).click(); const view = page.getByRole('region', { name: 'Dateiimport' }); await view.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' }); await view.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' });
    const chooser = page.waitForEvent('filechooser'); await view.getByRole('button', { name: 'Importdatei auswählen' }).click(); await (await chooser).setFiles({ name: 'p5-layout.csv', mimeType: 'text/csv', buffer: Buffer.from('Datum;Betrag;Empfänger;Notiz;ID\n05.10.2026;-1.234.567,89;Österreichische Gemeinschaftsbäckerei;AußergewöhnlicheHaushaltsausgabenUndFamilienrücklagen;1\n31.02.2026;fehlerhaft;Bäckerei;Fehler;2') }); await view.getByRole('button', { name: 'Vorschau erstellen' }).click(); await expect(view.locator('.import-preview')).toContainText('1.234.567,89');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('import.png'), fullPage: true });
    await view.getByRole('button', { name: 'Vorschau verwerfen' }).click(); await page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Dauerzahlungen', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('automatisierung.png'), fullPage: true });
  });
}

test('gleichzeitige Übernahme in zwei Tabs erzeugt genau eine Gruppe', async ({ page, context }, info) => {
  const url = `/tests/workspace.html?count=0&desktop=${info.project.name.startsWith('Desktop')}`;
  await page.goto(url); const first = await select(page, csv(200)); const other = await context.newPage(); await other.goto(url); await other.getByRole('button', { name: 'Import', exact: true }).click(); const second = other.getByRole('region', { name: 'Dateiimport' }); await expect(second).toContainText('Bereit · 0 / 200');
  await Promise.all([first.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(), second.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click()]);
  await expect.poll(async () => [(await first.getByRole('status').innerText()), (await second.getByRole('status').innerText())].filter(message => message.includes('gespeichert')).length).toBe(2);
  const all = await page.evaluate(() => window.workspaceTest.read()); expect(all.filter(a => a.aggregateType === 'transaction')).toHaveLength(100); expect(all.filter(a => a.aggregateType === 'importFingerprint')).toHaveLength(100); await other.close();
});

test('verwaltet kollidierende Regeln, zeigt Stop-Reihenfolge und prüft sie vor Import', async ({ page }, info) => {
  await page.goto(`/tests/workspace.html?count=0&desktop=${info.project.name.startsWith('Desktop')}`); await page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }).click();
  for (const value of ['cleared', 'uncleared']) {
    await page.getByLabel('Bedingungswert').fill('Öl'); await page.getByRole('combobox', { name: 'Regelaktion' }).selectOption('clearance'); await page.getByRole('combobox', { name: 'Aktionswert' }).selectOption(value); await page.getByRole('button', { name: 'Regel anlegen' }).click(); await expect.poll(() => page.getByRole('button', { name: 'Regel deaktivieren' }).count()).toBe(value === 'cleared' ? 1 : 2);
  }
  await page.getByRole('button', { name: 'Nach oben' }).nth(1).click(); await expect(page.getByRole('listitem').first()).toContainText('1. memo contains Öl');
  await page.getByRole('button', { name: 'Import', exact: true }).click(); const view = await select(page, csv(1)); await view.getByRole('button', { name: 'Nächste Gruppe übernehmen (bis 100)' }).click(); await expect(view).toContainText('Abgeschlossen'); const transactions = (await page.evaluate(() => window.workspaceTest.read())).filter(a => a.aggregateType === 'transaction') as unknown as { clearance: string }[]; expect(transactions).toHaveLength(1); expect(transactions[0]?.clearance).toBe('uncleared');
  await page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }).click(); await page.getByRole('button', { name: 'Regel bearbeiten' }).first().click(); await page.getByRole('combobox', { name: 'Aktionswert' }).selectOption('cleared'); await page.getByRole('button', { name: 'Regel ändern' }).click(); await expect(page.getByRole('button', { name: 'Regel ändern' })).toHaveCount(0); await page.getByRole('button', { name: 'Regel löschen' }).nth(1).click(); await expect(page.getByRole('button', { name: 'Regel löschen' })).toHaveCount(1);
});
