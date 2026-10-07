// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const passphrase = 'synthetische-pr46-schluesselpaare';
const key = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';
const appPath = `/@fs${fileURLToPath(new URL('../../packages/ui/src/app.tsx', import.meta.url))}`;
const cryptoPath = `/@fs${fileURLToPath(new URL('../../packages/crypto/src/index.ts', import.meta.url))}`;

for (const field of ['identityPublicKey', 'identityPrivateKey', 'encryptionPublicKey', 'encryptionPrivateKey'] as const) {
  for (const recovery of [false, true]) {
    test(`B01/A02: authentisch beschädigte ${field} wird mit ${recovery ? 'Rettungscode' : 'Passphrase'} abgewiesen`, async ({ page }) => {
      // Nur Vite-Testlauf: synthetischen authentischen Fehlerstand über die bestehenden Cryptoports erzeugen.
      await page.goto('/');
      const code = await page.evaluate(async (input) => {
        const app = await import(input.appPath) as typeof import('../../packages/ui/src/app.js');
        const cryptoPort = await import(input.cryptoPath) as typeof import('../../packages/crypto/src/index.js');
        const created = await app.createLocalProfile(input.passphrase);
        const producer = await cryptoPort.unlockUserVaultWithPassphrase(created.profile.vault, input.passphrase);
        const index = input.field === 'identityPrivateKey' ? 63 : 1;
        producer[input.field][index] = (producer[input.field][index] ?? 0) ^ 1;
        const record = await cryptoPort.persistUnlockedUserVault(producer, created.profile.vault);
        localStorage.setItem(input.key, JSON.stringify({ ...created.profile, vault: record }));
        await cryptoPort.lockUserVault(producer);
        return created.recoveryCode;
      }, { appPath, cryptoPath, key, field, passphrase });
      const original = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Tresor entsperren' })).toBeVisible();
      if (recovery) await page.getByLabel('Rettungscode verwenden').check();
      await page.getByLabel(recovery ? 'Rettungscode' : 'Entsperrpassphrase', { exact: true }).fill(recovery ? code : passphrase);
      await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Originaldatensatz bleibt erhalten');
      await expect(page.locator('.app-shell')).toHaveCount(0);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(original);
      await expect(page.getByRole('button', { name: 'Tresor anlegen' })).toHaveCount(0);
    });
  }
}
