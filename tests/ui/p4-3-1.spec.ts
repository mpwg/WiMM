// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { book, createCategory, createPayee, createVault, saved, rows, readAggregates } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
for (const touch of [false, true]) test.describe(touch ? 'Touch' : 'Tastatur', () => {
  test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
  test('erfasst F01 mit Datum, Empfänger und Notiz und bewahrt ungültige Entwürfe', async ({ page }, info) => {
    await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z')); await createVault(page); await createAccount(page, 'Girokonto', '1000'); await createCategory(page, 'Lebensmittel'); await createCategory(page, 'Gehalt', 'Einnahmen', 'income'); await createPayee(page, 'Bäckerei F01');
    const dialog = await book(page, '-100', 'Wocheneinkauf F01', 'Girokonto', 'Lebensmittel', 'Bäckerei F01'); const submit = dialog.getByRole('button', { name: 'Lokal speichern' });
    if (touch) await submit.tap(); else { await submit.focus(); await page.keyboard.press('Enter'); }
    await expect(dialog).toHaveCount(0); await page.getByLabel('Durchsuchen').fill('Wocheneinkauf F01'); await expect(rows(page)).toHaveCount(1); await page.getByLabel('Durchsuchen').fill('');
    await book(page, '200', 'Einnahme F01', 'Girokonto', 'Gehalt'); await saved(page); await navigate(page, 'Übersicht');
    await expect(page.locator('.overview-hero')).toContainText('1.100,00'); await expect(page.locator('.overview-grid article').filter({ hasText: 'Monatsausgaben' })).toContainText('100,00'); await expect(page.locator('.overview-grid article').filter({ hasText: 'Monatseinnahmen' })).toContainText('200,00'); await page.screenshot({ path: info.outputPath('f01-übersicht.png'), fullPage: true });
    const draft = await book(page, '-50', 'Ungültiger Entwurf F01', 'Girokonto', 'Lebensmittel', 'Bäckerei F01'); const before = await readAggregates(page); const amount = draft.getByLabel('Betrag', { exact: true });
    for (const invalid of ['12,345', 'abc', '90071992547410,00']) { await amount.fill(invalid); await draft.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(amount).toHaveAttribute('aria-invalid', 'true'); await expect(amount).toHaveValue(invalid); expect(await readAggregates(page)).toEqual(before); }
    await amount.fill('50'); await draft.getByLabel('Datum', { exact: true }).fill(''); await draft.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(draft.getByLabel('Datum', { exact: true })).toHaveAttribute('aria-invalid', 'true'); await expect(draft.getByLabel('Notiz', { exact: true })).toHaveValue('Ungültiger Entwurf F01'); expect(await readAggregates(page)).toEqual(before);
    await draft.getByLabel('Datum', { exact: true }).fill('2026-10-04'); await saved(page); await expect(rows(page)).toHaveCount(4);
  });
});
