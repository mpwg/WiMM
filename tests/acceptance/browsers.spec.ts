// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdir, mkdtemp } from 'node:fs/promises';
import { chromium, firefox, webkit, expect, test, type Page } from '@playwright/test';
import { createAccount, navigate as nav, openAccountAction } from '../helpers/ui.js';
import { createVault, createCategory, unlock, book, saved } from '../helpers/local.js';
async function value(page: Page, label: string, amount: string) { await expect(page.locator(label === 'Kontostand gesamt' ? '.overview-hero' : '.overview-grid article').filter({ hasText: label })).toContainText(amount); }
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
    await createVault(page); await createAccount(page, 'Girokonto', '1000'); await createAccount(page, 'Bargeld');
    await createCategory(page, 'Lebensmittel'); await createCategory(page, 'Gehalt', 'Einkommen', 'income');
    await book(page, '-100', 'Einkauf'); await saved(page); await book(page, '200', 'Gehalt', 'Girokonto', 'Gehalt'); await saved(page);
    await nav(page, 'Übersicht'); await value(page, 'Kontostand gesamt', '1.100,00'); await value(page, 'Monatsausgaben', '100,00'); await value(page, 'Monatseinnahmen', '200,00');
    await book(page, '-100', 'Split'); await page.getByText('Aufteilen', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Split-Kategorie (optional)', exact: true }).selectOption({ label: 'Lebensmittel' });
    await page.getByLabel('Erster Splitbetrag').fill('-60'); await page.getByLabel('Zweiter Splitbetrag').fill('-39');
    await nav(page, 'Lokal speichern'); await expect(page.getByRole('alert')).toContainText('Splitsumme'); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(3);
    await page.getByLabel('Zweiter Splitbetrag').fill('-40'); await saved(page); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(4);
    const transfer = await openAccountAction(page, 'Girokonto', 'Umbuchen');
    await transfer.getByLabel('Von', { exact: true }).selectOption({ label: 'Girokonto' }); await transfer.getByLabel('Nach', { exact: true }).selectOption({ label: 'Bargeld' });
    await transfer.getByLabel('Umbuchungsdatum').fill('2026-10-05'); await transfer.getByLabel('Umbuchungsbetrag').fill('200');
    await transfer.getByRole('button', { name: 'Umbuchung speichern' }).focus(); await page.keyboard.press('Enter'); await expect(transfer).toHaveCount(0);
    const reconciliation = await openAccountAction(page, 'Girokonto', 'Abgleichen');
    await reconciliation.getByLabel('Abgleichkonto').selectOption({ label: 'Girokonto' }); await reconciliation.getByLabel('Auszugsdatum').fill('2026-10-05'); await reconciliation.getByLabel('Auszugssaldo').fill('801');
    await reconciliation.getByRole('button', { name: 'Buchungen auswählen', exact: true }).click(); const boxes = reconciliation.getByRole('checkbox'); for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    await reconciliation.getByRole('button', { name: 'Abgleich prüfen' }).click(); await expect(reconciliation.getByRole('button', { name: 'Abgleich bestätigen' })).toBeDisabled(); await reconciliation.getByRole('button', { name: 'Zurück', exact: true }).click(); await reconciliation.getByRole('button', { name: 'Zurück', exact: true }).click();
    await reconciliation.getByLabel('Auszugssaldo').fill('800'); await reconciliation.getByRole('button', { name: 'Buchungen auswählen', exact: true }).click(); await reconciliation.getByRole('button', { name: 'Abgleich prüfen' }).click(); await reconciliation.getByRole('button', { name: 'Abgleich bestätigen' }).focus(); await page.keyboard.press('Enter'); await expect(reconciliation).toHaveCount(0); await page.getByRole('button', { name: 'Zurück zu Konten' }).click();
    await expect(page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Girokonto', exact: true }) })).toContainText('800,00'); await expect(page.getByRole('row').filter({ hasText: 'Bargeld' })).toContainText('200,00');
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
    await context.setOffline(true); await unlock(page); await value(page, 'Kontostand gesamt', '1.000,00'); await value(page, 'Monatsausgaben', '200,00'); await value(page, 'Monatseinnahmen', '200,00');
    await nav(page, 'Buchungen'); await expect(page.locator('tr[data-transaction-id]')).toHaveCount(6); await page.locator('tr[data-transaction-id]').filter({ hasText: 'Girokonto' }).first().getByRole('button', { name: /^Details:/ }).click(); await expect(page.getByRole('dialog')).toContainText('Abgeglichen – gesperrt'); await expect(page.getByRole('dialog').getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await info.attach('Laufzeit', { body: JSON.stringify({ browser: browserType.name(), version, client: desktop ? 'Desktop-Frontend mit IndexedDB' : 'Web', offlineStart }), contentType: 'application/json' });
  } finally { await context.close(); }
});
