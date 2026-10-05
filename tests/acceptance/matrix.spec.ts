// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type Page } from '@playwright/test';
import { navigate } from '../helpers/ui.js';

for (const desktop of [false, true]) test(`${desktop ? 'Desktop-Frontend' : 'Web'}: mehrzeilige Mobilnavigation reserviert ihre tatsächliche Höhe`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`/tests/workspace.html?desktop=${desktop}&count=1`);
  const navigation = page.locator('.mobile-navigation');
  await expect(navigation).toBeVisible();
  // Erzwingt auch auf macOS den auf Linux beobachteten Schriftumbruch.
  await navigation.locator('button').evaluateAll((buttons) => buttons.forEach((button) => { (button as HTMLElement).style.fontSize = '24px'; }));
  await expect.poll(async () => (await navigation.boundingBox())?.height ?? 0).toBeGreaterThan(64);
  const overlap = async () => {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const content = await page.locator('.finance-main').boundingBox();
    const bar = await navigation.boundingBox();
    return content!.y + content!.height - bar!.y;
  };
  await expect.poll(overlap).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(navigation).toBeHidden();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(navigation).toBeVisible();
  await expect.poll(overlap).toBeLessThanOrEqual(0);
});

async function layout(page: Page) {
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.locator('.money, .overview-grid strong').evaluateAll((elements) => elements.filter((element) => element.getBoundingClientRect().width > 0).every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
  expect(await page.locator('dialog[open]').evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
}
for (const desktop of [false, true]) for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [1920, 1080]]) for (const scheme of ['light', 'dark'] as const) {
  test(`${desktop ? 'Desktop-Frontend' : 'Web'} ${width}×${height} ${scheme}: Ansichten, Details, Fehler und modaler Fokus`, async ({ page }, info) => {
    await page.setViewportSize({ width: width!, height: height! }); await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`/tests/workspace.html?desktop=${desktop}&count=1&matrix=true`);
    for (const name of ['Übersicht', 'Konten', 'Kategorien', 'Empfänger', 'Buchungen']) {
      await navigate(page, name); await expect(page.getByRole('heading', { name: name === 'Übersicht' ? 'Alles im Blick.' : name, exact: true })).toBeVisible();
      if (width! < 768) {
        const navigation = await page.locator('.mobile-navigation').boundingBox();
        const reserved = await page.locator('.app-shell').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
        expect(reserved).toBeGreaterThanOrEqual(navigation!.height);
        await expect(page.getByRole('heading', { name: name === 'Übersicht' ? 'Alles im Blick.' : name, exact: true })).toBeInViewport();
      }
      await layout(page); await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    }
    await page.getByRole('region', { name: 'Buchungsliste' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('Buchungsliste.png'), fullPage: true });
    await page.getByRole('button', { name: /^Details:/ }).click(); const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('-€'); await expect(dialog).toContainText('1.234.567,89'); await layout(page);
    for (let index = 0; index < 12; index++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true); }
    await page.screenshot({ path: info.outputPath('Details.png'), fullPage: true });
    await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click(); await dialog.getByLabel('Betrag', { exact: true }).fill('ungültig');
    await dialog.getByRole('button', { name: 'Änderung speichern' }).click(); await expect(dialog.getByLabel('Betrag', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await layout(page); await page.screenshot({ path: info.outputPath('Feldfehler.png'), fullPage: true });
    // Gemessener WCAG-Textkontrast der tatsächlich berechneten Styles.
    const contrasts = await page.locator('.app-shell p, .app-shell label, .app-shell button, .app-shell strong, .app-shell th, .app-shell td, .app-shell small, dialog dt, dialog dd').evaluateAll((elements) => {
      const parse = (color: string) => color.match(/[\d.]+/g)?.map(Number) ?? [];
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      return elements.filter((element) => element.getBoundingClientRect().width > 0 && element.textContent?.trim() && !element.closest('button:disabled')).map((element) => {
        let background: number[] = [];
        for (let parent: Element | null = element; parent !== null; parent = parent.parentElement) { const rgb = parse(getComputedStyle(parent).backgroundColor); if (rgb.length === 3 || rgb[3] === 1) { background = rgb; break; } }
        const foreground = parse(getComputedStyle(element).color); const a = luminance(foreground), b = luminance(background);
        return { text: element.textContent?.slice(0, 60), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    });
    await info.attach('Textkontraste', { body: JSON.stringify(contrasts), contentType: 'application/json' });
    expect(contrasts.filter((entry) => entry.ratio < 4.5)).toEqual([]);
  });
}
