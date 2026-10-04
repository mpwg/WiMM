// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'lokale-passphrase-2026';

async function unlockLocalArea(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Rettungscode sichern' })).toBeVisible();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
}

test('erfasst einen ersten Kontostart und bleibt bei 320 Pixeln ohne Seitenüberlauf', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await unlockLocalArea(page);

  await page.getByRole('button', { name: 'Konten' }).click();
  const longName = 'Gemeinschaftliches Rücklagenkonto für außergewöhnlich lange deutsche Bezeichnungen';
  await page.getByLabel('Kontoname').fill(longName);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: longName })).toBeVisible();

  await page.getByRole('button', { name: 'Buchungen' }).click();
  await page.getByLabel('Anfangsbestand').check();
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: longName });
  await page.getByLabel('Betrag').fill('1234,56');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByText('Lokal gespeichert.')).toBeVisible();

  await page.getByRole('button', { name: 'Konten' }).click();
  await page.getByRole('button', { name: 'Archivieren' }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Konten' })).toBeVisible();
  await expect(page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).resolves.toBe(true);
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await expect(page.getByRole('heading', { name: 'Noch keine Konten' })).toBeVisible();
});

test('wechselt Bereiche, führt Empfänger atomar zusammen und erhält zugängliche Erscheinungsmodi', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await unlockLocalArea(page);
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(28, 28, 30)');

  const overview = page.getByRole('button', { name: 'Übersicht' });
  await page.keyboard.press('Tab');
  await expect(overview).toBeVisible();
  await expect(page.locator('style, link[rel="stylesheet"]').evaluateAll(() =>
    [...document.styleSheets].some((sheet) => {
      try { return [...sheet.cssRules].some((rule) => rule.cssText.includes(':focus-visible') && rule.cssText.includes('outline')); }
      catch { return false; }
    })
  )).resolves.toBe(true);
  await page.getByRole('button', { name: '+ Haushalt anlegen' }).click();
  await expect(page.getByText('Gemeinsamer Bereich')).toBeVisible();
  await page.getByLabel('Bereich').selectOption({ label: 'Privater Bereich' });
  await expect(page.getByText('Privatbereich')).toBeVisible();

  await page.getByRole('button', { name: 'Empfänger' }).click();
  await page.getByLabel('Empfänger', { exact: true }).fill('Bäckerei am Hauptplatz');
  await page.getByRole('button', { name: 'Empfänger anlegen' }).click();
  await expect(page.getByRole('list').getByText('Bäckerei am Hauptplatz', { exact: true })).toBeVisible();
  await page.getByLabel('Empfänger', { exact: true }).fill('Bäckerei Hauptplatz');
  await page.getByRole('button', { name: 'Empfänger anlegen' }).click();
  await expect(page.getByRole('list').getByText('Bäckerei Hauptplatz', { exact: true })).toBeVisible();
  await page.getByLabel('Quell-Empfänger').selectOption({ label: 'Bäckerei am Hauptplatz' });
  await page.getByLabel('Ziel-Empfänger').selectOption({ label: 'Bäckerei Hauptplatz' });
  await page.getByRole('button', { name: 'Zusammenführen und archivieren' }).click();
  await page.getByRole('dialog', { name: 'Empfänger zusammenführen?' }).getByRole('button', { name: 'Zusammenführen', exact: true }).click();
  await expect(page.getByText('Bäckerei am Hauptplatz', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('list').getByText('Bäckerei Hauptplatz', { exact: true })).toBeVisible();
});
