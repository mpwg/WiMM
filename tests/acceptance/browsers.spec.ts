// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdir, mkdtemp } from 'node:fs/promises';
import { chromium, firefox, webkit, expect, test, type Page } from '@playwright/test';
const passphrase = 'p4-6-synthetische-passphrase';
async function unlock(page: Page) {
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
}
async function nav(page: Page, name: string) { await page.getByRole('button', { name, exact: true }).click(); }
async function booking(page: Page, amount: string, category?: string) {
  await page.getByLabel('Betrag', { exact: true }).fill(amount);
  await page.getByLabel('Datum', { exact: true }).fill('2026-10-05');
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Girokonto' });
  if (category) await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: category });
  else await page.getByLabel('Anfangsbestand', { exact: true }).check();
}
async function saved(page: Page) {
  const button = page.getByRole('button', { name: 'Lokal speichern' });
  await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('');
}
async function value(page: Page, label: string, amount: string) {
  await expect(page.locator('.overview-grid article').filter({ hasText: label })).toContainText(amount);
}
test('F01/F02/F03 und Abgleich, gesperrter Tresor und dauerhafter Browserneustart', async ({ browserName, baseURL }, info) => {
  const browserType = { chromium, firefox, webkit }[browserName];
  const desktop = process.env.WIMM_CLIENT === 'desktop';
  if (baseURL === undefined) throw new Error('Clientadresse fehlt');
  await mkdir(`${process.cwd()}/.toolchain-checks`, { recursive: true });
  const profile = await mkdtemp(`${process.cwd()}/.toolchain-checks/p4-6-${desktop ? 'desktop' : 'web'}-${browserName}-`);
  const launch = () => browserType.launchPersistentContext(profile, { headless: true, baseURL });
  let context = await launch();
  try {
    let page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
    await page.goto('/');
    await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByLabel('Passphrase wiederholen').fill(passphrase);
    await nav(page, 'Tresor anlegen'); await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check(); await nav(page, 'Lokalen Bereich eröffnen'); await unlock(page);
    await nav(page, 'Konten');
    for (const name of ['Girokonto', 'Bargeld']) { await page.getByLabel('Kontoname').fill(name); await nav(page, 'Konto anlegen'); await expect(page.getByRole('cell', { name, exact: true })).toBeVisible(); }
    await nav(page, 'Kategorien');
    for (const [kind, name] of [['expense', 'Lebensmittel'], ['income', 'Gehalt']]) {
      await page.getByLabel('Neue Kategoriegruppe').fill(name!); await page.getByRole('combobox', { name: 'Art', exact: true }).selectOption(kind!); await nav(page, 'Gruppe anlegen');
      await expect(page.getByLabel('Neue Kategoriegruppe')).toHaveValue(''); await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: name! });
      await page.getByLabel('Kategorie', { exact: true }).fill(name!); await nav(page, 'Kategorie anlegen'); await expect(page.getByRole('listitem').filter({ hasText: name! })).toBeVisible();
    }
    await nav(page, 'Buchungen'); await booking(page, '1000'); await saved(page);
    await booking(page, '-100', 'Lebensmittel'); await saved(page); await booking(page, '200', 'Gehalt'); await saved(page);
    await nav(page, 'Übersicht'); await value(page, 'Verfügbares Geld', '1.100,00'); await value(page, 'Monatsausgaben', '100,00'); await value(page, 'Monatseinnahmen', '200,00');
    await nav(page, 'Buchungen'); await booking(page, '-100', 'Lebensmittel');
    await page.getByRole('combobox', { name: 'Split-Kategorie (optional)', exact: true }).selectOption({ label: 'Lebensmittel' });
    await page.getByLabel('Erster Splitbetrag').fill('-60'); await page.getByLabel('Zweiter Splitbetrag').fill('-39');
    await nav(page, 'Lokal speichern'); await expect(page.getByRole('alert')).toContainText('Splitsumme'); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(3);
    await page.getByLabel('Zweiter Splitbetrag').fill('-40'); await saved(page); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(4);
    await nav(page, 'Konten'); const transfer = page.getByRole('form', { name: 'Umbuchung', exact: true });
    await transfer.getByLabel('Von', { exact: true }).selectOption({ label: 'Girokonto' }); await transfer.getByLabel('Nach', { exact: true }).selectOption({ label: 'Bargeld' });
    await transfer.getByLabel('Umbuchungsdatum').fill('2026-10-05'); await transfer.getByLabel('Umbuchungsbetrag').fill('200');
    await transfer.getByRole('button', { name: 'Umbuchung speichern' }).focus(); await page.keyboard.press('Enter'); await expect(transfer.getByLabel('Umbuchungsbetrag')).toHaveValue('');
    const reconciliation = page.getByRole('form', { name: 'Abgleich', exact: true });
    await reconciliation.getByLabel('Abgleichkonto').selectOption({ label: 'Girokonto' }); await reconciliation.getByLabel('Auszugsdatum').fill('2026-10-05'); await reconciliation.getByLabel('Auszugssaldo').fill('801');
    const boxes = reconciliation.getByRole('checkbox'); for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    await expect(reconciliation.getByRole('button', { name: 'Abgleich bestätigen' })).toBeDisabled();
    await reconciliation.getByLabel('Auszugssaldo').fill('800'); await reconciliation.getByRole('button', { name: 'Abgleich bestätigen' }).focus(); await page.keyboard.press('Enter'); await expect(reconciliation.getByLabel('Auszugssaldo')).toHaveValue('');
    await expect(page.getByRole('row').filter({ hasText: 'Girokonto' })).toContainText('800,00'); await expect(page.getByRole('row').filter({ hasText: 'Bargeld' })).toContainText('200,00');
    if (!desktop && browserType.name() === 'chromium') {
      await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    }
    const version = context.browser()?.version();
    await context.close(); context = await launch();
    // Chromium belegt PWA-Assets bereits vor dem Neuaufruf ohne Netzwerk.
    // Die anderen Browser und das Desktop-Frontend laden ihre Assets zuerst lokal.
    const offlineStart = !desktop && browserType.name() === 'chromium';
    if (offlineStart) await context.setOffline(true);
    page = await context.newPage(); await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z')); const response = await page.goto('/');
    if (offlineStart) expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible(); await expect(page.locator('.app-shell')).toHaveCount(0);
    await page.getByLabel('Entsperrpassphrase').fill('falsche-passphrase'); await nav(page, 'Entsperren'); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveCount(0);
    await context.setOffline(true); await unlock(page); await value(page, 'Verfügbares Geld', '1.000,00'); await value(page, 'Monatsausgaben', '200,00'); await value(page, 'Monatseinnahmen', '200,00');
    await nav(page, 'Buchungen'); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(6); await page.locator('tr[data-transaction-id]').filter({ hasText: 'Girokonto' }).first().getByRole('button', { name: 'Details' }).click(); await expect(page.getByRole('dialog')).toContainText('Abgeglichen – gesperrt'); await expect(page.getByRole('dialog').getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await info.attach('Laufzeit', { body: JSON.stringify({ browser: browserType.name(), version, client: desktop ? 'Desktop-Frontend mit IndexedDB' : 'Web', offlineStart }), contentType: 'application/json' });
  } finally { await context.close(); }
});
