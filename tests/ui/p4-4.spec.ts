// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';
const passphrase = 'p4-4-einzelabnahme-passphrase';
async function prepare(page: Page) {
  await page.goto('/'); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click(); await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check(); await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await page.getByRole('button', { name: 'Konten', exact: true }).click();
  for (const name of ['Girokonto', 'Bargeld']) { await page.getByLabel('Kontoname').fill(name); await page.getByRole('button', { name: 'Konto anlegen' }).click(); await expect(page.getByRole('cell', { name, exact: true })).toBeVisible(); }
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click(); await page.getByLabel('Betrag', { exact: true }).fill('1000'); await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Girokonto' }); await page.getByLabel('Anfangsbestand', { exact: true }).check(); await page.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('');
}
for (const touch of [false, true]) test.describe(touch ? 'Touch' : 'Tastatur', () => {
  test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
  test('F03 im tatsächlichen Client und bereichsgebundene Historie mit Entwurfsschutz', async ({ page }, info) => {
    await prepare(page); await page.getByRole('button', { name: 'Konten', exact: true }).click(); const form = page.getByRole('form', { name: 'Umbuchung', exact: true });
    await form.getByLabel('Von', { exact: true }).selectOption({ label: 'Girokonto' }); await form.getByLabel('Nach', { exact: true }).selectOption({ label: 'Bargeld' }); await form.getByLabel('Umbuchungsbetrag').fill('200');
    const save = form.getByRole('button', { name: 'Umbuchung speichern' });
    if (touch) await save.tap(); else { await form.getByLabel('Umbuchungsdatum').focus(); for (let step = 0; step < 8 && !await save.evaluate((element) => element === document.activeElement); step += 1) await page.keyboard.press('Tab'); await expect(save).toBeFocused(); await page.keyboard.press('Enter'); }
    await expect(form.getByLabel('Umbuchungsbetrag')).toHaveValue('');
    await expect(page.getByRole('row').filter({ hasText: 'Girokonto' })).toContainText(/800,00/); await expect(page.getByRole('row').filter({ hasText: 'Bargeld' })).toContainText(/200,00/);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click(); await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText(/1.000,00/); for (const label of ['Monatsausgaben', 'Monatseinnahmen']) await expect(page.locator('.overview-grid article').filter({ hasText: label })).toContainText(/0,00/);
    await page.getByRole('button', { name: 'Rückgängig', exact: true }).click(); await page.getByRole('button', { name: 'Konten', exact: true }).click(); await expect(page.getByRole('row').filter({ hasText: 'Girokonto' })).toContainText(/1.000,00/);
    await page.getByRole('button', { name: 'Wiederholen', exact: true }).click(); await expect(page.getByRole('row').filter({ hasText: 'Girokonto' })).toContainText(/800,00/);
    await page.getByRole('button', { name: '+ Haushalt anlegen', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Konten', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Wiederholen', exact: true })).toBeDisabled();
    await page.getByLabel('Bereich', { exact: true }).selectOption({ label: 'Privater Bereich' }); await page.getByRole('button', { name: 'Buchungen', exact: true }).click(); await page.getByLabel('Betrag', { exact: true }).fill('-55');
    const picker = page.getByLabel('Bereich', { exact: true }); const household = await picker.locator('option').last().getAttribute('value'); await picker.selectOption(household!);
    let prompt = page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' }); await expect(prompt).toBeVisible(); await prompt.getByRole('button', { name: 'Weiter bearbeiten' }).click(); await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('-55'); await expect(picker).toBeFocused();
    await picker.selectOption(household!); await prompt.getByRole('button', { name: 'Eingaben verwerfen' }).click(); await page.getByRole('button', { name: 'Übersicht', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible(); await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText(/0,00/);
    await picker.selectOption({ label: 'Privater Bereich' }); await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText(/1.000,00/); await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('f03-bereichswechsel.png'), fullPage: true });
  });
});
