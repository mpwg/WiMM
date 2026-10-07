// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
const appPath = `/@fs${fileURLToPath(new URL('../../packages/ui/src/app.tsx', import.meta.url))}`;
const fixturePath = `/@fs${fileURLToPath(new URL('../../packages/crypto/src/legacy-vault.fixture.ts', import.meta.url))}`;
const passphrase = 'synthetische-legacy-kdf-2026';
const key = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
test('Legacyprofil bleibt über Recovery nutzbar und wird nach Passphraseentsperrung atomar gehärtet', async ({ page }) => {
  await page.goto('/');
  const code = await page.evaluate(async input => {
    const app = await import(input.appPath) as typeof import('../../packages/ui/src/app.js');
    const fixture = await import(input.fixturePath) as typeof import('../../packages/crypto/src/legacy-vault.fixture.js');
    const created = await app.createLocalProfile(input.passphrase);
    const legacy = await fixture.legacyVaultRecord(created.profile.vault, created.recoveryCode, input.passphrase);
    localStorage.setItem(input.key, JSON.stringify({ ...created.profile, vault: legacy })); return created.recoveryCode;
  }, { appPath, fixturePath, passphrase, key });
  const original = await page.evaluate(storageKey => localStorage.getItem(storageKey), key); expect(original).toBeTruthy();
  await page.reload(); await page.getByLabel('Rettungscode verwenden').check(); await page.getByLabel('Rettungscode', { exact: true }).fill(code); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(original);
  await page.reload(); await page.getByLabel('Entsperrpassphrase').fill(passphrase); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  const upgraded = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!) as import('../../packages/ui/src/app.js').LocalProfile, key);
  expect(upgraded.vault.passphraseWrap).toMatchObject({ version: 2, kdf: { opslimit: 3, memlimit: 67108864 } });
  const prior = JSON.parse(original!) as import('../../packages/ui/src/app.js').LocalProfile;
  expect(upgraded.vault.vault).toEqual(prior.vault.vault); expect(upgraded.vault.recoveryWrap).toEqual(prior.vault.recoveryWrap);
  await page.reload(); await page.getByLabel('Rettungscode verwenden').check(); await page.getByLabel('Rettungscode', { exact: true }).fill(code); await page.getByRole('button', { name: 'Entsperren', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
});
