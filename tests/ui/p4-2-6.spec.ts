// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';

const account = 'Gemeinschaftliches Rücklagenkonto für außergewöhnliche Familienausgaben';
const group = 'Langfristige Rücklagen für außergewöhnliche Haushaltsausgaben';
const category = 'AußergewöhnlicheHaushaltsausgabenUndFamilienrücklagen';
const payee = 'Österreichische Gemeinschaftsbäckerei mit außergewöhnlich langer Bezeichnung';

async function checkLayout(page: Page): Promise<void> {
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const smallTargets = await page.locator('.app-shell button, .app-shell input, .app-shell select').evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
  }).map((element) => element.outerHTML));
  expect(smallTargets).toEqual([]);
  expect(await page.locator('.app-shell').evaluate((element) => getComputedStyle(element).fontFamily)).toContain('system-ui');
  // Seitenüberlauf und inneres Tabellenscrolling werden getrennt geprüft.
  // Geldzellen dürfen weder umbrechen noch ihren Text abschneiden.
  expect(await page.locator('.money, .overview-grid strong').evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth))).toBe(true);
}

for (const width of [320, 768, 900, 1024]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${width} Pixel, System ${scheme}: Navigation und lange Stammdaten mit vollständigen Beträgen`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1024 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.getByLabel('Entsperrpassphrase').fill('p4-2-6-layout-passphrase');
      await page.getByLabel('Passphrase wiederholen').fill('p4-2-6-layout-passphrase');
      await page.getByRole('button', { name: 'Tresor anlegen' }).click();
      await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
      await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
      await page.getByLabel('Entsperrpassphrase').fill('p4-2-6-layout-passphrase');
      await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
      const background = (value: string) => value === 'dark' ? 'rgb(28, 28, 30)' : 'rgb(245, 245, 247)';
      await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(scheme));
      const other = scheme === 'dark' ? 'light' : 'dark';
      await page.emulateMedia({ colorScheme: other });
      await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(other));
      await page.getByLabel('Farbschema').selectOption(scheme);
      await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(scheme));
      await page.reload();
      await page.getByLabel('Entsperrpassphrase').fill('p4-2-6-layout-passphrase');
      await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
      await expect(page.getByLabel('Farbschema')).toHaveValue(scheme);
      await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(scheme));
      await page.getByLabel('Farbschema').selectOption('system');
      await expect(page.locator('.app-shell')).toHaveCSS('background-color', background(other));
      await page.emulateMedia({ colorScheme: scheme });

      await page.getByRole('button', { name: 'Konten', exact: true }).click();
      await page.getByLabel('Kontoname').fill(account);
      await page.getByRole('button', { name: 'Konto anlegen' }).click();
      await expect(page.getByRole('cell', { name: account })).toBeVisible();
      await checkLayout(page);
      await page.getByRole('button', { name: 'Buchungen' }).click();
      await page.getByLabel('Anfangsbestand', { exact: true }).click();
      await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
      await page.getByLabel('Betrag', { exact: true }).fill('1234567,89');
      await page.getByRole('button', { name: 'Lokal speichern' }).click();
      await expect(page.getByText('Lokal gespeichert.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Konten', exact: true }).click();
      await expect(page.locator('td.money')).toContainText('1.234.567,89');
      await checkLayout(page);
      await page.locator('td.money').scrollIntoViewIfNeeded();
      await expect(page.locator('td.money')).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath('konten.png'), fullPage: true });

      await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
      await page.getByLabel('Neue Kategoriegruppe').fill(group);
      await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
      await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: group });
      await page.getByLabel('Kategorie', { exact: true }).fill(category);
      await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
      await expect(page.getByRole('listitem').filter({ hasText: category })).toBeVisible();
      await checkLayout(page);
      await page.screenshot({ path: testInfo.outputPath('kategorien.png'), fullPage: true });

      await page.getByRole('button', { name: 'Empfänger', exact: true }).click();
      for (const name of [payee, `${payee} Zweigstelle`]) {
        await page.getByLabel('Empfänger', { exact: true }).fill(name);
        await page.getByRole('button', { name: 'Empfänger anlegen' }).click();
        await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
      }
      await page.getByLabel('Quell-Empfänger').selectOption({ label: payee });
      await page.getByLabel('Ziel-Empfänger').selectOption({ label: `${payee} Zweigstelle` });
      await checkLayout(page);
      await page.screenshot({ path: testInfo.outputPath('empfänger.png'), fullPage: true });

      await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
      await expect(page.locator('.overview-grid strong').first()).toContainText('1.234.567,89');
      await checkLayout(page);
      await page.screenshot({ path: testInfo.outputPath('übersicht.png'), fullPage: true });
    });
  }
}
