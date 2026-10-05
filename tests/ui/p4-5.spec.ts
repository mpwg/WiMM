// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { createVault, createCategory } from '../helpers/local.js';
import { createAccount } from '../helpers/ui.js';

test('Kurzbefehle, Fachhistorie, Text-Undo und Entwurfsschutz', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Portkonto'); await createCategory(page, 'Einnahmen', 'Gehalt', 'income');
  await page.keyboard.press('ControlOrMeta+n'); await expect(page.getByLabel('Betrag', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Einnahme', exact: true }).click(); await page.getByLabel('Betrag', { exact: true }).fill('1000'); await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Portkonto' }); await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Einnahmen' }); await page.getByRole('button', { name: 'Lokal speichern' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click(); await expect(page.locator('.overview-hero')).toContainText('1.000,00'); await page.keyboard.press('ControlOrMeta+z'); await expect(page.locator('.overview-hero')).toContainText('0,00'); await page.keyboard.press('ControlOrMeta+Shift+z'); await expect(page.locator('.overview-hero')).toContainText('1.000,00');
  await page.keyboard.press('ControlOrMeta+f'); await expect(page.getByLabel('Durchsuchen', { exact: true })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+n'); const amount = page.getByLabel('Betrag', { exact: true }); await expect(amount).toBeFocused(); await page.keyboard.type('123'); await page.keyboard.press('ControlOrMeta+z'); await expect(amount).toHaveValue(''); await page.keyboard.press('ControlOrMeta+Shift+z'); await expect(amount).toHaveValue('123');
  await page.keyboard.press('Escape'); const prompt = page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' }); await expect(prompt).toBeVisible(); await prompt.getByRole('button', { name: 'Weiter bearbeiten' }).click(); await expect(amount).toHaveValue('123'); await page.keyboard.press('Escape'); await prompt.getByRole('button', { name: 'Eingaben verwerfen' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tresor sperren' }).click(); await page.keyboard.press('ControlOrMeta+n'); await expect(page.getByLabel('Entsperrpassphrase')).toBeVisible(); await expect(page.locator('.app-shell')).toHaveCount(0);
});

test('Browserdateiauswahl, Abbruch, Download und sicherer Fremdlink', async ({ page }) => {
  test.skip(process.env.WIMM_BUILD === '1', 'Port-Harness verwendet den Entwicklungsserver; native Prüfung separat.');
  await page.goto('/');
  // Echter Browserport mit synthetischen Daten; keine Import-/Exportfachfunktion.
  await page.evaluate(async (moduleUrl) => {
    const module = await import(moduleUrl) as typeof import('../../packages/ui/src/platform.js');
    const port = module.createBrowserPlatformServices();
    Object.assign(window, { testPort: port });
    for (const [id, action] of Object.entries({ choose: () => port.chooseImportFiles({ acceptedExtensions: ['txt'], acceptedMediaTypes: ['text/plain'], multiple: false }).then((files: unknown) => { Object.assign(window, { chosen: files }); }), save: () => port.writeExport({ suggestedName: 'p4-5-synthetic.txt', mediaType: 'text/plain', bytes: new TextEncoder().encode('Synthetische Portprüfung') }), link: () => port.openExternalUrl('https://github.com/mpwg/WiMM') })) {
      const button = document.createElement('button'); button.textContent = id; button.onclick = () => { void action(); }; document.body.append(button);
    }
  }, `/@fs/${process.cwd()}/packages/ui/src/platform.ts`);
  const picker = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'choose', exact: true }).click(); await (await picker).setFiles({ name: 'synthetic.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetische Portprüfung') });
  await expect.poll(() => page.evaluate(() => (window as unknown as { chosen: { name: string }[] }).chosen?.[0]?.name)).toBe('synthetic.txt');
  const secondPicker = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'choose', exact: true }).click(); await secondPicker;
  await page.locator('input[type=file]').dispatchEvent('cancel'); await expect.poll(() => page.evaluate(() => (window as unknown as { chosen: unknown[] }).chosen.length)).toBe(0);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'save', exact: true }).click(); const file = await download; expect(file.suggestedFilename()).toBe('p4-5-synthetic.txt');
  const stream = await file.createReadStream(); const chunks = []; for await (const chunk of stream!) chunks.push(chunk); expect(Buffer.concat(chunks).toString()).toBe('Synthetische Portprüfung');
  const popupEvent = page.waitForEvent('popup'); await page.getByRole('button', { name: 'link', exact: true }).click(); const popup = await popupEvent; expect(await popup.evaluate(() => window.opener === null)).toBe(true); await popup.close();
  await page.evaluate(async () => { const port = (window as unknown as { testPort: { openExternalUrl: (value: string) => Promise<void> } }).testPort; for (const value of ['file:///tmp/test', 'javascript:alert(1)']) { try { await port.openExternalUrl(value); throw new Error('Unerlaubter Link akzeptiert'); } catch (error) { if (!(error instanceof TypeError)) throw error; } } });
});
