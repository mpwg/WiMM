// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test, type Page } from '@playwright/test';

const passphrase = 'p4-2-5-empfängermerge-passphrase-2026';
const account = 'Girokonto Empfängermergetest';
const category = 'Lebensmittel Empfängermergetest';
const source = 'Bäckerei am Hauptplatz';
const target = 'Bäckerei Hauptplatz';

async function expectMergedBooking(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Empfänger', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: target })).toHaveCount(1);
  await expect(page.getByRole('listitem').filter({ hasText: source })).toHaveCount(0);

  await page.getByRole('button', { name: 'Buchungen' }).click();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole('cell', { name: target, exact: true })).toBeVisible();
  await expect(rows.getByRole('cell', { name: account, exact: true })).toBeVisible();
  await expect(rows.getByRole('cell', { name: category, exact: true })).toBeVisible();
  await expect(rows.getByRole('cell', { name: '2026-10-04', exact: true })).toBeVisible();
  await expect(rows.getByRole('cell', { name: /-€\s*40,00/ })).toBeVisible();
  const selection = page.getByRole('combobox', { name: 'Empfänger', exact: true });
  await expect(selection.getByRole('option', { name: source, exact: true })).toHaveCount(0);
  await expect(selection.getByRole('option', { name: target, exact: true })).toHaveCount(1);
}

test('führt einen referenzierten Empfänger zusammen und erhält Buchung und Archivierung nach Chromium-Neustart', async ({ baseURL }, testInfo) => {
  // Ein echtes Browserprofil bewahrt IndexedDB und lokalen Tresor auf Platte.
  // Beide Starts verwenden dasselbe Profil, ohne storageState oder DB-Kopie.
  if (baseURL === undefined) throw new Error('Für die Neustartprüfung ist eine Clientadresse erforderlich.');
  const profile = testInfo.outputPath('chromium-profile');
  const launch = () => chromium.launchPersistentContext(profile, {
    channel: 'chromium-headless-shell', headless: true, baseURL
  });
  let context = await launch();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByLabel('Entsperrpassphrase').fill(passphrase);
    await page.getByLabel('Passphrase wiederholen').fill(passphrase);
    await page.getByRole('button', { name: 'Tresor anlegen' }).click();
    await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
    await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
    await page.getByLabel('Entsperrpassphrase').fill(passphrase);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();

    await page.getByRole('button', { name: 'Konten' }).click();
    await page.getByLabel('Kontoname').fill(account);
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('cell', { name: account })).toBeVisible();
    await page.getByRole('button', { name: 'Kategorien' }).click();
    await page.getByLabel('Neue Kategoriegruppe').fill('Alltagsausgaben Empfängermergetest');
    await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
    await expect(page.getByRole('combobox', { name: 'Gruppe' }).getByRole('option', { name: 'Alltagsausgaben Empfängermergetest' })).toHaveCount(1);
    await page.getByLabel('Kategorie', { exact: true }).fill(category);
    await page.getByRole('combobox', { name: 'Gruppe' }).selectOption({ label: 'Alltagsausgaben Empfängermergetest' });
    await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: category })).toBeVisible();

    await page.getByRole('button', { name: 'Empfänger', exact: true }).click();
    for (const name of [source, target]) {
      await page.getByLabel('Empfänger', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Empfänger anlegen' }).click();
      await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Buchungen' }).click();
    await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account });
    await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: category });
    await page.getByRole('combobox', { name: 'Empfänger', exact: true }).selectOption({ label: source });
    await page.getByLabel('Datum').fill('2026-10-04');
    await page.getByLabel('Betrag', { exact: true }).fill('-40,00');
    await page.getByRole('button', { name: 'Lokal speichern' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('cell', { name: source, exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Empfänger', exact: true }).click();
    await page.getByLabel('Quell-Empfänger').selectOption({ label: source });
    await page.getByLabel('Ziel-Empfänger').selectOption({ label: target });
    await page.getByRole('button', { name: 'Zusammenführen und archivieren' }).click();
    await expect(page.getByRole('dialog', { name: 'Empfänger zusammenführen?' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Empfänger zusammenführen?' }).getByRole('button', { name: 'Zusammenführen', exact: true }).click();
    await expectMergedBooking(page);

    await context.close();
    context = await launch();
    const restarted = await context.newPage();
    await restarted.goto('/');
    await expect(restarted.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
    await expect(restarted.locator('tbody tr')).toHaveCount(0);
    await restarted.getByLabel('Entsperrpassphrase').fill(passphrase);
    await restarted.getByRole('button', { name: 'Entsperren' }).click();
    await expect(restarted.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
    await expectMergedBooking(restarted);
  } finally {
    await context.close();
  }
});
