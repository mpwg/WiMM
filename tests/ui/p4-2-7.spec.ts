// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Locator, type Page } from '@playwright/test';

const passphrase = 'p4-2-7-tastaturfokus-passphrase-2026';
const account = 'Girokonto Tastaturfokus';
const group = 'Alltagsausgaben Tastaturfokus';
const category = 'Lebensmittel Tastaturfokus';
const source = 'Bäckerei Tastaturquelle';
const target = 'Bäckerei Tastaturziel';

async function expectVisibleFocus(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  expect(await locator.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
}

async function tabUntil(page: Page, locator: Locator): Promise<void> {
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) {
      await expectVisibleFocus(locator);
      return;
    }
  }
  throw new Error(`Das Bedienelement ${await locator.ariaSnapshot()} ist nicht per Tabulator erreichbar.`);
}

async function typeAtFocused(page: Page, locator: Locator, value: string): Promise<void> {
  await tabUntil(page, locator);
  await locator.fill(value);
}

async function unlockLocalArea(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
}

test('bedient Bereich, Navigation und Stammdaten per Tastatur und gibt den Dialogfokus zurück', async ({ page }) => {
  await unlockLocalArea(page);

  const area = page.getByLabel('Bereich');
  await tabUntil(page, area);
  await tabUntil(page, page.getByRole('button', { name: '+ Haushalt anlegen' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();
  await tabUntil(page, area);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expectVisibleFocus(area);
  await page.keyboard.press('p');
  await expect(page.getByText('Privatbereich', { exact: true })).toBeVisible();
  await tabUntil(page, area);
  await page.keyboard.press('h');
  await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();

  const accounts = page.getByRole('button', { name: 'Konten', exact: true });
  await tabUntil(page, accounts);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Konten', exact: true })).toBeVisible();
  await typeAtFocused(page, page.getByLabel('Kontoname'), account);
  await tabUntil(page, page.getByRole('button', { name: 'Konto anlegen' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('cell', { name: account })).toBeVisible();

  const categories = page.getByRole('button', { name: 'Kategorien', exact: true });
  await tabUntil(page, categories);
  await page.keyboard.press('Enter');
  await typeAtFocused(page, page.getByLabel('Neue Kategoriegruppe'), group);
  await tabUntil(page, page.getByRole('button', { name: 'Gruppe anlegen' }));
  await page.keyboard.press('Enter');
  await typeAtFocused(page, page.getByLabel('Kategorie', { exact: true }), category);
  await tabUntil(page, page.getByRole('combobox', { name: 'Gruppe', exact: true }));
  await page.keyboard.press('a');
  await tabUntil(page, page.getByRole('button', { name: 'Kategorie anlegen' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: category })).toBeVisible();

  const payees = page.getByRole('button', { name: 'Empfänger', exact: true });
  await tabUntil(page, payees);
  await page.keyboard.press('Enter');
  for (const name of [source, target]) {
    await typeAtFocused(page, page.getByLabel('Empfänger', { exact: true }), name);
    await tabUntil(page, page.getByRole('button', { name: 'Empfänger anlegen' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
    await expect(page.getByLabel('Empfänger', { exact: true })).toBeEnabled();
  }
  await tabUntil(page, page.getByLabel('Quell-Empfänger'));
  await page.keyboard.press('b');
  await tabUntil(page, page.getByLabel('Ziel-Empfänger'));
  await page.keyboard.press('b');
  const merge = page.getByRole('button', { name: 'Zusammenführen und archivieren' });
  await tabUntil(page, merge);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Empfänger zusammenführen?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectVisibleFocus(merge);
});
