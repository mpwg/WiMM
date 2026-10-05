// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { createVault, createPayee } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
test('erfasst einen ersten Kontostart und bleibt bei 320 Pixeln ohne Seitenüberlauf', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await createVault(page);
  const name = 'Gemeinschaftliches Rücklagenkonto für außergewöhnlich lange deutsche Bezeichnungen'; await createAccount(page, name, '1234,56');
  await page.getByRole('button', { name: 'Archivieren' }).click(); await expect(page.getByRole('heading', { name: 'Noch keine Konten' })).toBeVisible();
  expect(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.evaluate(() => { document.body.style.zoom = '2'; }); await expect(page.getByRole('heading', { name: 'Noch keine Konten' })).toBeVisible();
});
test('wechselt Bereiche, führt Empfänger atomar zusammen und erhält zugängliche Erscheinungsmodi', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await createVault(page); await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(23, 29, 27)');
  await page.getByRole('button', { name: 'Haushalt anlegen', exact: true }).click(); await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await createPayee(page, 'Bäckerei am Hauptplatz'); await createPayee(page, 'Bäckerei Hauptplatz'); await navigate(page, 'Empfänger');
  await page.getByRole('button', { name: 'Empfänger zusammenführen', exact: true }).click(); await page.getByLabel('Quell-Empfänger').selectOption({ label: 'Bäckerei am Hauptplatz' }); await page.getByLabel('Ziel-Empfänger').selectOption({ label: 'Bäckerei Hauptplatz' });
  await page.getByRole('button', { name: 'Zusammenführen und archivieren' }).click(); await page.getByRole('button', { name: 'Zusammenführen', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Bäckerei Hauptplatz' })).toHaveCount(1); await expect(page.getByText('Bäckerei am Hauptplatz', { exact: true })).toHaveCount(0);
});
