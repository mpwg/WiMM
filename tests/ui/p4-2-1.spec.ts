// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { createVault } from '../helpers/local.js';
import { createAccount, navigate } from '../helpers/ui.js';
test('macht Navigation und aktiven Bereich sichtbar und trennt private von gemeinsamen Konten', async ({ page }) => {
  await createVault(page); await createAccount(page, 'Privatkonto Navigationstest');
  await page.getByRole('button', { name: 'Haushalt anlegen', exact: true }).click();
  await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();
  await createAccount(page, 'Haushaltskonto Navigationstest');
  for (const name of ['Übersicht', 'Buchungen', 'Kategorien', 'Empfänger', 'Konten']) {
    await navigate(page, name);
    await expect(page.getByRole('heading', { name: name === 'Übersicht' ? 'Alles im Blick.' : name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Privatkonto Navigationstest', { exact: true })).toHaveCount(0);
  await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await expect(page.getByRole('button', { name: 'Privatkonto Navigationstest', exact: true })).toBeVisible();
  await expect(page.getByText('Haushaltskonto Navigationstest', { exact: true })).toHaveCount(0);
});
