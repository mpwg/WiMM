// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LocalProfile } from '../../packages/ui/src/app.js';
import { expect, test, type Page } from '@playwright/test';

const passphrase = 'b01-synthetische-passphrase-2026';
const key = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
const readProfile = async (page: Page) => JSON.parse((await profileValue(page))!) as LocalProfile;
const profileValue = (page: Page) => page.evaluate((storageKey) => localStorage.getItem(storageKey), key);

async function unlock(page: Page, recoveryCode?: string) {
  if (recoveryCode !== undefined) await page.getByLabel('Rettungscode verwenden').check();
  await page.getByLabel(recoveryCode === undefined ? 'Entsperrpassphrase' : 'Rettungscode', { exact: true }).fill(recoveryCode ?? passphrase);
  await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
}

async function create(page: Page) {
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase', { exact: true }).fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  const code = (await page.getByRole('status', { name: 'Rettungscode' }).textContent())!;
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await unlock(page);
  return code;
}

test('B01/A01: zwei echte Tabs erhalten beide Haushalte samt Schlüsseln nach veraltetem Wechsel und Neustart', async ({ page, context }) => {
  const code = await create(page);
  const initial = JSON.parse((await profileValue(page))!) as { selectedAreaId: string };
  const second = await context.newPage();
  await second.goto('/');
  await unlock(second);
  await Promise.all([
    page.getByRole('button', { name: 'Haushalt anlegen' }).click(),
    second.getByRole('button', { name: 'Haushalt anlegen' }).click()
  ]);
  await expect.poll(async () => (await readProfile(page)).areas.length).toBe(3);
  // Beide Sitzungen dürfen mit ihrem ursprünglich geladenen Bestand weiterschreiben.
  await page.getByLabel('Bereich', { exact: true }).selectOption(initial.selectedAreaId);
  await expect(page.getByLabel('Bereich', { exact: true })).toHaveValue(initial.selectedAreaId);
  await expect.poll(async () => (await readProfile(page)).revision).toBe(4);
  expect((await readProfile(page)).areas).toHaveLength(3);
  for (const secret of [undefined, code]) {
    await page.reload();
    await unlock(page, secret);
    const picker = page.getByLabel('Bereich', { exact: true });
    await expect(picker.locator('option')).toHaveCount(3);
    for (const label of ['Haushalt 1', 'Haushalt 2']) {
      await picker.selectOption({ label });
      await expect(page.getByText('Gemeinsamer Bereich', { exact: true })).toBeVisible();
    }
  }
  await second.close();
});

test('B01/A01: Quota erhält Originalprofil und Sitzung; Doppelklick legt nur einen Haushalt an', async ({ page }) => {
  await create(page);
  const before = await profileValue(page);
  await page.evaluate(() => {
    // Bindung bleibt beim aufrufenden Storageobjekt.
    const setItem = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as (storageKey: string, value: string) => void;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey.includes('profile')) throw new DOMException('Synthetischer Speicherfehler', 'QuotaExceededError');
      Reflect.apply(setItem, this, [storageKey, value]);
    };
  });
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await expect(page.getByRole('alert')).toContainText('nicht dauerhaft gespeichert');
  expect(await profileValue(page)).toBe(before);
  await page.reload();
  await unlock(page);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(async () => (await readProfile(page)).areas.length).toBe(2);
  await page.getByRole('button', { name: 'Tresor sperren' }).click();
  await unlock(page);
  await expect(page.getByLabel('Bereich', { exact: true }).locator('option')).toHaveCount(2);
});

test('B01/A01: Sperren während wartender Profiländerung verhindert Commit und erneutes Entsperren', async ({ page }) => {
  await create(page);
  const before = await profileValue(page);
  await page.evaluate((storageKey) => {
    void navigator.locks.request(`wimm:profile:${storageKey}`, () => new Promise<void>((resolve) => {
      (window as unknown as { releaseProfileLock: () => void }).releaseProfileLock = resolve;
    }));
  }, key);
  await expect.poll(() => page.evaluate(() => 'releaseProfileLock' in window)).toBe(true);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await page.getByRole('button', { name: 'Tresor sperren' }).click();
  await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseProfileLock: () => void }).releaseProfileLock());
  // Die nächste Lockanfrage wartet auf das Ende der abgebrochenen Mutation.
  await page.evaluate((storageKey) => navigator.locks.request(`wimm:profile:${storageKey}`, () => undefined), key);
  expect(await profileValue(page)).toBe(before);
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
  await unlock(page);
});

test('B01/A01: Ersteinrichtung ohne Web Locks erklärt die fehlende Speicherkoordination und schreibt kein Profil', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }));
  await page.goto('/');
  await page.getByLabel('Entsperrpassphrase', { exact: true }).fill(passphrase);
  await page.getByLabel('Passphrase wiederholen').fill(passphrase);
  await page.getByRole('button', { name: 'Tresor anlegen' }).click();
  await page.getByLabel('Ich habe den Rettungscode sicher abgelegt.').check();
  await page.getByRole('button', { name: 'Lokalen Bereich eröffnen' }).click();
  await expect(page.getByRole('alert')).toContainText('unterstützt keine sichere lokale Speicherkoordination');
  await expect(page.getByRole('alert')).toContainText('aktuellen unterstützten Browser');
  expect(await profileValue(page)).toBeNull();
  await expect(page.getByRole('heading', { name: 'Rettungscode sichern' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('fehlende-speicherkoordination.png'), mask: [page.getByRole('status', { name: 'Rettungscode' })] });
});
