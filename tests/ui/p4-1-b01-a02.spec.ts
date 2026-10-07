// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
const key = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';

for (const [name, original] of [['JSON', '{synthetisch defekt'], ['Struktur', JSON.stringify({ profileId: 'ungueltig', areas: [{}], vault: {} })]]) {
  test(`B01/A02: beschädigte ${name} erhält Originalbytes und zeigt keinen Erststart`, async ({ page }, info) => {
    await page.addInitScript(({ storageKey, raw }) => localStorage.setItem(storageKey, raw), { storageKey: key, raw: original! });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Lokales Profil nicht verfügbar' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Originaldatensatz bleibt erhalten');
    await expect(page.getByRole('button', { name: 'Tresor anlegen' })).toHaveCount(0);
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(original);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Lokales Profil nicht verfügbar' })).toBeVisible();
    const screenshot = info.outputPath('profilfehler.png');
    await page.screenshot({ path: screenshot });
    await info.attach('Profilfehleransicht', { path: screenshot, contentType: 'image/png' });
  });
}

test('B01/A02: Lesefehler lädt genau einmal und ersetzt vorhandene Bytes nicht', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, 'synthetische Originalbytes');
    const read = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!.value as (key: string) => string | null;
    (window as unknown as { profileReads: number }).profileReads = 0;
    Storage.prototype.getItem = function (currentKey) {
      if (currentKey === storageKey) {
        (window as unknown as { profileReads: number }).profileReads += 1;
        throw new DOMException('Synthetischer Lesefehler', 'SecurityError');
      }
      return Reflect.apply(read, this, [currentKey]) as string | null;
    };
  }, key);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lokales Profil nicht verfügbar' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('kann nicht gelesen werden');
  await expect(page.getByRole('button', { name: 'Tresor anlegen' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { profileReads: number }).profileReads)).toBe(1);
  // Der unveränderte Wert wird über den Storageindex gelesen, ohne den künstlich blockierten Port.
  expect(await page.evaluate((storageKey) => localStorage[storageKey] as string, key)).toBe('synthetische Originalbytes');
});

test('B01/A02: ausschließlich fehlendes Profil öffnet den Erststart und lädt genau einmal', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const read = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!.value as (key: string) => string | null;
    (window as unknown as { profileReads: number }).profileReads = 0;
    Storage.prototype.getItem = function (currentKey) {
      if (currentKey === storageKey) (window as unknown as { profileReads: number }).profileReads += 1;
      return Reflect.apply(read, this, [currentKey]) as string | null;
    };
  }, key);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lokalen Tresor anlegen' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { profileReads: number }).profileReads)).toBe(1);
  expect(await page.evaluate((storageKey) => localStorage[storageKey] as string | undefined, key)).toBeUndefined();
});
