// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
for (const mobile of [false, true]) test(`Navigation und richtige Kontosumme ${mobile ? 'mobil' : 'Desktop'}`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/workspace.html?count=3');
  await expect(page.getByText('Kontostand gesamt', { exact: true })).toBeVisible();
  await expect(page.getByText('Verfügbares Geld', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ausstehende Änderungen', { exact: true })).toHaveCount(0);
  if (mobile) {
    await page.getByRole('button', { name: 'Mehr', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.getByRole('button', { name: /^Einstellungen/ }).click();
  await page.getByRole('button', { name: /^Kategorien/ }).click();
  await expect(page.getByRole('heading', { name: 'Kategorien', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Alle Einstellungen' }).click();
  await page.getByLabel('Farbschema').selectOption('dark');
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(23, 29, 27)');
});
