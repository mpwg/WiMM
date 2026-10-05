// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TransactionAggregate } from '../../packages/domain/src/index.js';
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, desktop: boolean, count = 3) {
  await page.clock.setFixedTime(new Date('2026-10-04T13:00:00Z'));
  await page.goto(`/tests/workspace.html?desktop=${desktop}&count=${count}`);
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Buchungsliste' })).toBeVisible();
}
const rows = (page: Page) => page.locator('tr[data-transaction-id]');
const read = (page: Page) => page.evaluate(() => window.workspaceTest.read());

test('verzögerter Commit sowie Quota und Disk-full erhalten alle Splitwerte und erlauben genau einen Wiederholversuch', async ({ page }, info) => {
  await open(page, info.project.name.startsWith('Desktop'));
  await page.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: 'Testkonto' });
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: 'Testkategorie' });
  await page.getByRole('combobox', { name: 'Split-Kategorie (optional)', exact: true }).selectOption({ label: 'Testkategorie' });
  await page.getByLabel('Betrag', { exact: true }).fill('-100');
  await page.getByLabel('Erster Splitbetrag').fill('-60');
  await page.getByLabel('Zweiter Splitbetrag').fill('-30');
  await page.getByRole('button', { name: 'Split hinzufügen' }).click();
  await page.getByRole('combobox', { name: 'Split-Kategorie 3', exact: true }).selectOption({ label: 'Testkategorie' });
  await page.getByLabel('Splitbetrag 3', { exact: true }).fill('-10');
  await page.getByLabel('Notiz').fill('Vollständiger Entwurf');
  const before = await read(page);
  for (const mode of ['quota', 'disk']) {
    await page.evaluate((value) => window.workspaceTest.mode(value), mode);
    await page.getByRole('button', { name: 'Lokal speichern' }).click();
    await expect(page.getByRole('alert')).toContainText('Speicher ist voll');
    await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('-100');
    await expect(page.getByLabel('Erster Splitbetrag')).toHaveValue('-60');
    await expect(page.getByLabel('Zweiter Splitbetrag')).toHaveValue('-30');
    await expect(page.getByLabel('Splitbetrag 3', { exact: true })).toHaveValue('-10');
    await expect(page.getByLabel('Notiz')).toHaveValue('Vollständiger Entwurf');
    await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('2026-10-04');
    await expect(page.getByRole('combobox', { name: 'Konto', exact: true })).toHaveValue('00000000-0000-4000-8000-000000000003');
    for (const name of ['Kategorie', 'Split-Kategorie (optional)', 'Split-Kategorie 3']) {
      await expect(page.getByRole('combobox', { name, exact: true })).toHaveValue('00000000-0000-4000-8000-000000000005');
    }
    await expect(page.getByRole('combobox', { name: 'Empfänger', exact: true })).toHaveValue('');
    await expect(page.getByLabel('Anfangsbestand', { exact: true })).not.toBeChecked();
    expect(await read(page)).toEqual(before);
    await expect(page.getByText('Lokal gespeichert.', { exact: true })).toHaveCount(0);
  }
  await page.evaluate(() => window.workspaceTest.mode('delay'));
  await page.getByRole('button', { name: 'Lokal speichern' }).click();
  await expect(page.getByRole('button', { name: 'Wird gespeichert …' })).toBeDisabled();
  await expect(page.getByLabel('Bereich')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Konten', exact: true })).toBeDisabled();
  await expect(page.getByText('Lokal gespeichert.', { exact: true })).toHaveCount(0);
  expect(await read(page)).toEqual(before);
  await page.evaluate(() => { window.workspaceTest.mode('normal'); window.workspaceTest.release(); });
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByLabel('Betrag', { exact: true })).toHaveValue('');
  const after = await read(page);
  expect(after.filter((entry) => entry.aggregateType === 'transaction' && (entry as unknown as TransactionAggregate).note === 'Vollständiger Entwurf')).toHaveLength(1);
});

test('veraltete Bearbeitung überschreibt keine Fremdänderung, gesperrte Buchungen erlauben keine Änderung oder Löschung', async ({ page }, info) => {
  await open(page, info.project.name.startsWith('Desktop'));
  const first = rows(page).filter({ hasText: 'Buchung 00000' });
  const id = await first.getAttribute('data-transaction-id');
  await first.getByRole('button', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Notiz').fill('Mein offener Entwurf');
  await page.evaluate((value) => window.workspaceTest.stale(value!), id);
  await dialog.getByRole('button', { name: 'Änderung speichern' }).click();
  await expect(dialog.getByRole('alert')).toContainText('inzwischen geändert');
  await expect(dialog.getByLabel('Notiz')).toHaveValue('Mein offener Entwurf');
  expect(((await read(page)).find((entry) => entry.id === id) as unknown as TransactionAggregate).note).toBe('Zwischenzeitlich geändert');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await page.getByRole('dialog', { name: 'Ungespeicherte Eingaben verwerfen?' }).getByRole('button', { name: 'Eingaben verwerfen' }).click();
  await rows(page).filter({ hasText: 'Buchung 00002' }).getByRole('button', { name: 'Details' }).click();
  await expect(dialog).toContainText('Abgeglichen – gesperrt');
  await expect(dialog.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
});

test('50.000 Buchungen bleiben mit begrenzten DOM-Zeilen am Anfang, in der Mitte und am Ende bearbeitbar und behalten Rückkehrfokus', async ({ page }, info) => {
  await open(page, info.project.name.startsWith('Desktop'), 50_000);
  const region = page.getByRole('region', { name: 'Buchungsliste' });
  await expect(page.getByText('50000 Buchungen', { exact: true })).toBeVisible();
  expect(await rows(page).count()).toBeLessThanOrEqual(16);
  for (const index of [0, 25_000, 49_999]) {
    await region.evaluate((element, target) => { element.scrollTop = target * 80; }, index);
    const row = rows(page).filter({ hasText: `Buchung ${String(index).padStart(5, '0')}` });
    await expect(row).toBeVisible();
    const trigger = row.getByRole('button', { name: 'Details' });
    await trigger.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Notiz').fill(`Bearbeitet ${index}`);
    await dialog.getByRole('button', { name: 'Änderung speichern' }).click();
    await expect(dialog).toHaveCount(0);
    const changed = rows(page).filter({ hasText: `Bearbeitet ${index}` });
    await expect(changed).toBeVisible();
    await expect(changed.getByRole('button', { name: 'Details' })).toBeFocused();
    expect(await rows(page).count()).toBeLessThanOrEqual(16);
  }
});
