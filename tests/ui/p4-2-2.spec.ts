// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { createVault, unlock } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
test('zeigt den leeren Bereich und erhält einen Anfangsbestand ohne Konsumeinnahme nach dem Neuladen', async ({ page }) => {
  await createVault(page);
  await expect(page.getByRole('heading', { name: 'Ihr erster Überblick' })).toBeVisible();
  await expect(page.locator('.hero-amount')).toHaveCount(0);
  await createAccount(page, 'Girokonto Kontostart', '1000,00');
  await navigate(page, 'Übersicht');
  await expect(page.locator('.overview-hero')).toContainText(/1.000,00/);
  for (const name of ['Monatsausgaben', 'Monatseinnahmen']) await expect(page.locator('.overview-grid article').filter({ hasText: name })).toContainText(/0,00/);
  await page.reload(); await unlock(page);
  await expect(page.locator('.overview-hero')).toContainText(/1.000,00/);
  for (const name of ['Monatsausgaben', 'Monatseinnahmen']) await expect(page.locator('.overview-grid article').filter({ hasText: name })).toContainText(/0,00/);
  await navigate(page, 'Konten'); await expect(page.getByRole('row').filter({ hasText: 'Girokonto Kontostart' })).toContainText('1.000,00');
});
