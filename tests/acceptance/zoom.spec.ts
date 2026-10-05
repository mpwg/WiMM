// SPDX-License-Identifier: AGPL-3.0-or-later
// Gesonderter GUI-Lauf: benötigt macOS-Bedienungshilfen und das echte Browsermenü.
import { chromium, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
test('echter Chromium-Browserzoom 200 Prozent, erreichbare Beträge, Feldfehler und Dialogfokus', async ({ baseURL }, info) => {
  if (baseURL === undefined) throw new Error('Clientadresse fehlt');
  await mkdir(`${process.cwd()}/.toolchain-checks`, { recursive: true });
  const profile = await mkdtemp(`${process.cwd()}/.toolchain-checks/p4-6-zoom-`);
  const context = await chromium.launchPersistentContext(profile, { headless: false, viewport: null, baseURL });
  try {
    const page = await context.newPage(); await page.goto('/tests/workspace.html?matrix=true&count=1');
    await expect(page.getByRole('heading', { name: 'Alles im Blick.', exact: true })).toBeVisible();
    const original = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    await page.bringToFront();
    execFileSync('osascript', ['-e', 'tell application "System Events" to tell process "Google Chrome for Testing"', '-e', 'set frontmost to true', '-e', 'click menu item "Originalgröße" of menu "Darstellung" of menu bar 1', '-e', 'repeat 5 times', '-e', 'click menu item "Vergrößern" of menu "Darstellung" of menu bar 1', '-e', 'delay 0.2', '-e', 'end repeat', '-e', 'end tell']);
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(original.dpr * 2);
    const zoomed = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
    expect(zoomed.width).toBe(original.width / 2); expect(zoomed.cssZoom).toBe('1');
    expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const name of ['Konten', 'Buchungen']) {
      if (name === 'Konten' && await page.locator('.mobile-navigation').isVisible()) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
      const button = page.getByRole('button', { name, exact: true });
      for (let index = 0; index < 100 && !await button.evaluate((element) => element === document.activeElement); index++) await page.keyboard.press('Tab');
      await expect(button).toBeFocused(); await page.keyboard.press('Enter'); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: /^Details:/ }).click(); const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1.234.567,89');
    for (let index = 0; index < 8; index++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true); }
    await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); const amount = dialog.getByLabel('Betrag', { exact: true });
    await amount.fill('ungültig'); await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(amount).toBeFocused(); await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await amount.scrollIntoViewIfNeeded(); await expect(amount).toBeInViewport();
    await page.screenshot({ path: info.outputPath('echter-zoom-200.png'), fullPage: true });
    await info.attach('Browserzoom', { body: JSON.stringify({ original, zoomed, version: context.browser()?.version(), method: 'Systemmenü Darstellung → Originalgröße → 5 × Vergrößern' }), contentType: 'application/json' });
  } finally { await context.close(); }
});
