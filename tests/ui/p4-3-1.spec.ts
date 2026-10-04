// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Locator, type Page } from '@playwright/test';

const passphrase = 'p4-3-1-einzelbuchung-passphrase-2026';
const account = 'Girokonto F01';
const date = '2026-10-04';

async function tabUntil(page: Page, locator: Locator): Promise<void> {
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Das Buchungsfeld ist nicht per Tabulator erreichbar.');
}

async function prepare(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await page.getByLabel('Entsperrpassphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await page.getByRole('button', { name: 'Konten', exact: true }).click();
  await page.getByLabel('Kontoname').fill(account);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('cell', { name: account })).toBeVisible();
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
  for (const [kind, group, category] of [['expense', 'Ausgaben F01', 'Lebensmittel F01'], ['income', 'Einnahmen F01', 'Gehalt F01']]) {
    await page.getByLabel('Neue Kategoriegruppe').fill(group!);
    await page.getByRole('combobox', { name: 'Art', exact: true }).selectOption(kind!);
    await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
    await expect(page.getByLabel('Neue Kategoriegruppe')).toHaveValue('');
    await page.getByLabel('Kategorie', { exact: true }).fill(category!);
    await page.getByRole('combobox', { name: 'Gruppe', exact: true }).selectOption({ label: group! });
    await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: category! })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Empfänger', exact: true }).click();
  await page.getByLabel('Empfänger', { exact: true }).fill('Bäckerei F01');
  await page.getByRole('button', { name: 'Empfänger anlegen' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Bäckerei F01' })).toBeVisible();
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
  await page.getByLabel('Anfangsbestand', { exact: true }).check();
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
  await page.getByLabel('Datum', { exact: true }).fill(date);
  await page.getByLabel('Betrag', { exact: true }).fill('1000,00');
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByRole('region', { name: 'Buchungsliste' }).locator('tbody tr')).toHaveCount(1);
}

for (const mode of ['Tastatur', 'Touch'] as const) {
  test.describe(mode, () => {
    test.use(mode === 'Touch' ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
    test('erfasst F01 mit Datum, Empfänger und Notiz und bewahrt ungültige Entwürfe', async ({ page }, testInfo) => {
      await prepare(page);
      const activate = async (locator: Locator) => {
        if (mode === 'Touch') await locator.tap();
        else { await tabUntil(page, locator); await page.keyboard.press(await locator.getAttribute('type') === 'checkbox' ? 'Space' : 'Enter'); }
      };
      const enter = async (locator: Locator, value: string) => {
        if (mode === 'Touch') await locator.tap(); else await tabUntil(page, locator);
        await locator.fill(value);
      };
      const choose = async (locator: Locator, initial: string, label: string) => {
        if (mode === 'Touch') { await locator.tap(); await locator.selectOption({ label }); }
        else { await tabUntil(page, locator); await page.keyboard.press(initial); }
      };
      const amount = page.getByLabel('Betrag', { exact: true });
      const calendar = page.getByLabel('Datum', { exact: true });
      const save = page.getByRole('button', { name: 'Lokal speichern' });
      await choose(page.getByRole('combobox', { name: 'Konto', exact: true }), 'g', account);
      await choose(page.getByRole('combobox', { name: 'Kategorie', exact: true }), 'l', 'Lebensmittel F01');
      await choose(page.getByRole('combobox', { name: 'Empfänger', exact: true }), 'b', 'Bäckerei F01');
      await enter(amount, '-100,00');
      await enter(calendar, date);
      await enter(page.getByLabel('Notiz', { exact: true }), 'Wocheneinkauf F01');
      await activate(save);
      const rows = page.getByRole('region', { name: 'Buchungsliste' }).locator('tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: 'Bäckerei F01' })).toContainText(date);
      await expect(rows.filter({ hasText: 'Bäckerei F01' })).toContainText(/-€\s*100,00/);
      // Die Notiz bleibt trotz sichtbarem Empfänger gespeichert und durchsuchbar.
      await page.getByLabel('Durchsuchen').fill('Wocheneinkauf F01');
      await expect(rows).toHaveCount(1);
      await page.getByLabel('Durchsuchen').fill('');
      await choose(page.getByRole('combobox', { name: 'Konto', exact: true }), 'g', account);
      await choose(page.getByRole('combobox', { name: 'Kategorie', exact: true }), 'g', 'Gehalt F01');
      await choose(page.getByRole('combobox', { name: 'Empfänger', exact: true }), 'o', 'Ohne Empfänger');
      await enter(amount, '+200,00');
      await enter(calendar, date);
      await enter(page.getByLabel('Notiz', { exact: true }), 'Einnahme F01');
      await activate(save);
      await expect(rows).toHaveCount(3);
      await expect(rows.filter({ hasText: 'Einnahme F01' })).toContainText(/€\s*200,00/);
      await activate(page.getByRole('button', { name: 'Übersicht', exact: true }));
      for (const [label, value] of [['Verfügbares Geld', /€\s*1[.\u00a0 ]?100,00/], ['Monatsausgaben', /€\s*100,00/], ['Monatseinnahmen', /€\s*200,00/]] as const) {
        await expect(page.locator('.overview-grid article').filter({ hasText: label })).toContainText(value);
      }
      await page.screenshot({ path: testInfo.outputPath('f01-übersicht.png'), fullPage: true });
      await activate(page.getByRole('button', { name: 'Buchungen', exact: true }));
      await choose(page.getByRole('combobox', { name: 'Konto', exact: true }), 'g', account);
      await choose(page.getByRole('combobox', { name: 'Kategorie', exact: true }), 'l', 'Lebensmittel F01');
      await choose(page.getByRole('combobox', { name: 'Empfänger', exact: true }), 'b', 'Bäckerei F01');
      await enter(calendar, date);
      await enter(page.getByLabel('Notiz', { exact: true }), 'Ungültiger Entwurf F01');
      for (const invalid of ['-12,345', 'abc', '90071992547410,00']) {
        await enter(amount, invalid);
        await activate(save);
        await expect(amount).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#transaction-amount-error')).toBeVisible();
        await expect(amount).toHaveValue(invalid);
        await expect(rows).toHaveCount(3);
      }
      await enter(amount, '-50,00');
      await enter(calendar, '2026-02-28');
      // Einen unvollständigen Kalenderwert im echten segmentierten Feld eingeben.
      // Ungültige volle Datumsstrings akzeptiert Chromiums Testtreiber nicht.
      await calendar.press('Backspace');
      await expect(calendar).toHaveValue('');
      await activate(save);
      await expect(calendar).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#transaction-date-error')).toBeVisible();
      await expect(page.getByLabel('Notiz', { exact: true })).toHaveValue('Ungültiger Entwurf F01');
      await expect(page.getByRole('combobox', { name: 'Konto', exact: true }).locator('option:checked')).toHaveText(account);
      await expect(page.getByRole('combobox', { name: 'Kategorie', exact: true }).locator('option:checked')).toHaveText('Lebensmittel F01');
      await expect(page.getByRole('combobox', { name: 'Empfänger', exact: true }).locator('option:checked')).toHaveText('Bäckerei F01');
      await expect(amount).toHaveValue('-50,00');
      await expect(rows).toHaveCount(3);
      await page.screenshot({ path: testInfo.outputPath('datumsfeldfehler.png'), fullPage: true });
      await enter(calendar, date);
      await activate(save);
      await expect(rows).toHaveCount(4);
      await expect(rows.filter({ hasText: 'Bäckerei F01' }).filter({ hasText: /-€\s*50,00/ })).toBeVisible();
    });
  });
}
