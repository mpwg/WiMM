// SPDX-License-Identifier: AGPL-3.0-or-later
import { chromium, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { prepare, importPreview } from '../ui/p5-helpers.js';
test('P5 bei echtem Browserzoom 200 Prozent: Vorschau, Fehler und Automatisierung erreichbar', async ({ baseURL }, info) => {
  if (baseURL === undefined) throw new Error('Clientadresse fehlt.');
  await mkdir(`${process.cwd()}/.toolchain-checks`, { recursive: true });
  const profile = await mkdtemp(`${process.cwd()}/.toolchain-checks/p5-zoom-`);
  const context = await chromium.launchPersistentContext(profile, { headless: false, viewport: null, baseURL });
  try {
    const page = await context.newPage(); await prepare(page);
    const original = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    execFileSync('osascript', ['-e', 'tell application "System Events" to tell process "Google Chrome for Testing"', '-e', 'set frontmost to true', '-e', 'click menu item "Originalgröße" of menu "Darstellung" of menu bar 1', '-e', 'repeat 5 times', '-e', 'click menu item "Vergrößern" of menu "Darstellung" of menu bar 1', '-e', 'end repeat', '-e', 'end tell']);
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(original.dpr * 2);
    const zoomed = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
    expect(zoomed.width).toBe(original.width / 2); expect(zoomed.cssZoom).toBe('1');
    const view = await importPreview(page, 'Datum;Betrag;Empfänger;Notiz;ID\n31.01.2028;-1.234.567,89;Österreichische Bäckerei;Außergewöhnliche Haushaltsausgaben;1\n31.02.2028;fehlerhaft;Markt;Fehler;2');
    await expect(view.locator('.import-preview')).toContainText('1.234.567,89');
    const row = view.locator('.import-preview > li').first(); await row.scrollIntoViewIfNeeded(); await expect(row).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('p5-import-zoom-200.png'), fullPage: true });
    await view.getByRole('button', { name: 'Entscheidungen bestätigen' }).click(); await expect(view.getByRole('status')).toContainText('ausdrückliche Entscheidung');
    await view.getByRole('button', { name: 'Vorschau verwerfen' }).click();
    const automation = page.getByRole('button', { name: 'Regeln und Dauerzahlungen', exact: true }); await automation.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Dauerzahlungen', exact: true })).toBeVisible();
    const amount = page.getByLabel('Dauerzahlungsbetrag'); await amount.scrollIntoViewIfNeeded(); await expect(amount).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('p5-automatisierung-zoom-200.png'), fullPage: true });
    await info.attach('Browserzoom', { body: JSON.stringify({ original, zoomed, version: context.browser()?.version(), method: 'Echtes Chromium-Systemmenü, kein CSS-Zoom' }), contentType: 'application/json' });
  } finally { await context.close(); }
});
