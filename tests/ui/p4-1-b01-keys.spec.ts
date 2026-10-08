// SPDX-License-Identifier: AGPL-3.0-or-later
import { createLocalProfile } from '../../packages/application/src/profile.js';
import { unlockUserVaultWithPassphrase, persistUnlockedUserVault, lockUserVault } from '../../packages/crypto/src/index.js';
import { expect, test } from '@playwright/test';

const passphrase = 'synthetische-pr46-schluesselpaare';
const key = process.env.WIMM_CLIENT === 'desktop' ? 'wimm/desktop-profile/v1' : 'wimm/local-profile/v1';

for (const field of ['identityPublicKey', 'identityPrivateKey', 'encryptionPublicKey', 'encryptionPrivateKey'] as const) {
  for (const recovery of [false, true]) {
    test(`B01/A02: authentisch beschädigte ${field} wird mit ${recovery ? 'Rettungscode' : 'Passphrase'} abgewiesen`, async ({ page }) => {
      // Der echte gebaute Client bleibt unverändert; nur der synthetische Producer läuft in Node.
      const created = await createLocalProfile(passphrase, { next: () => crypto.randomUUID() });
      const producer = await unlockUserVaultWithPassphrase(created.profile.vault, passphrase);
      const index = field === 'identityPrivateKey' ? 63 : 1;
      producer[field][index] = (producer[field][index] ?? 0) ^ 1;
      const record = await persistUnlockedUserVault(producer, created.profile.vault);
      await lockUserVault(producer);
      const code = created.recoveryCode;
      await page.goto('/');
      await page.evaluate((input) => localStorage.setItem(input.key, JSON.stringify(input.profile)), { key, profile: { ...created.profile, vault: record } });
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
