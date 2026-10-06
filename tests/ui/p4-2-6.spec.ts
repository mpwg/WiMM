// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';
import { createVault, createCategory, createPayee, unlock } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
async function layout(page: Page) {
  expect(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.locator('.app-shell button, .app-shell input, .app-shell select').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
  }).map(element => element.outerHTML))).toEqual([]);
  expect(await page.locator('.money').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).every(element => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
}
for (const width of [320, 768, 900, 1024]) for (const scheme of ['light', 'dark'] as const) test(`${width} Pixel, System ${scheme}: Navigation und lange Stammdaten mit vollständigen Beträgen`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1024 }); await page.emulateMedia({ colorScheme: scheme }); await createVault(page);
  const background = (value: string) => value === 'dark' ? 'rgb(23, 29, 27)' : 'rgb(245, 245, 241)';
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(scheme));
  const other = scheme === 'dark' ? 'light' : 'dark'; await page.emulateMedia({ colorScheme: other }); await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(other));
  await navigate(page, 'Einstellungen'); await page.getByLabel('Farbschema').selectOption(scheme);
  await page.reload(); await unlock(page); await navigate(page, 'Einstellungen'); await expect(page.getByLabel('Farbschema')).toHaveValue(scheme); await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(scheme));
  await page.getByLabel('Farbschema').selectOption('system'); await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(other)); await page.emulateMedia({ colorScheme: scheme });
  const name = 'Gemeinschaftliches Rücklagenkonto für außergewöhnliche Familienausgaben';
  await createAccount(page, name, '1234567,89'); await layout(page); await page.locator('td.money').scrollIntoViewIfNeeded(); await expect(page.locator('td.money')).toBeInViewport({ ratio: 0.99 }); await page.screenshot({ path: info.outputPath('konten.png'), fullPage: true });
  await createCategory(page, 'AußergewöhnlicheHaushaltsausgabenUndFamilienrücklagen', 'Langfristige Rücklagen für außergewöhnliche Haushaltsausgaben'); await layout(page); await page.screenshot({ path: info.outputPath('kategorien.png'), fullPage: true });
  await createPayee(page, 'Österreichische Gemeinschaftsbäckerei mit außergewöhnlich langer Bezeichnung'); await createPayee(page, 'Österreichische Gemeinschaftsbäckerei Zweigstelle'); await layout(page); await page.screenshot({ path: info.outputPath('empfänger.png'), fullPage: true });
  await navigate(page, 'Übersicht'); await expect(page.locator('.hero-amount')).toContainText('1.234.567,89'); await layout(page); await page.screenshot({ path: info.outputPath('übersicht.png'), fullPage: true });
});
