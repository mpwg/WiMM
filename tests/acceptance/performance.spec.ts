// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { arch, cpus, platform, release, totalmem } from 'node:os';
for (const desktop of [false, true]) test(`50.000 Buchungen: ${desktop ? 'Desktop-Frontend' : 'Web'} Öffnen, Filter und Scrollen`, async ({ page, browser }, info) => {
  await page.goto(`/tests/workspace.html?desktop=${desktop}&count=50000&performance=true`);
  await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
  await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText('-€');
  await expect(page.locator('.overview-grid article').filter({ hasText: 'Verfügbares Geld' })).toContainText('50.000,00');
  expect(await page.evaluate(() => window.workspaceTest.fixture())).toEqual({ transactions: 50000, accounts: 10, categories: 100, months: 36, sharedExpenseLoad: 1000 });
  await page.reload();
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
  await expect(page.getByText('50000 Buchungen', { exact: true })).toBeVisible();
  const coldOpen = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  const results = await page.evaluate(async () => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const start = performance.now();
    (Array.from(document.querySelectorAll('button')).find((element) => element.textContent === 'Buchungen')!).click();
    await frame();
    const open = performance.now() - start;
    if (document.querySelectorAll('tr[data-transaction-id]').length === 0) throw new Error('Liste noch nicht sichtbar');
    const search = document.querySelector<HTMLInputElement>('[data-transaction-search]')!;
    const scroller = document.querySelector<HTMLElement>('.transaction-scroll')!;
    const filter: number[] = [], scroll: number[] = [];
    for (let index = 0; index < 35; index++) {
      const begin = performance.now();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, index % 2 ? '' : 'Buchung 0');
      search.dispatchEvent(new Event('input', { bubbles: true })); await frame();
      if (document.querySelector('.transaction-filters + p')?.textContent !== `${index % 2 ? 50000 : 10000} Buchungen`) throw new Error('Filtertrefferzahl falsch');
      if (index >= 5) filter.push(performance.now() - begin);
    }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, ''); search.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    const oracle = Array.from({ length: 50000 }, (_, index) => index).sort((a, b) => b % 36 - a % 36 || a - b);
    const counts: number[] = [];
    for (let index = 0; index < 35; index++) {
      const begin = performance.now(); scroller.scrollTop = (index * 1471 % 49000) * 80; await frame();
      const firstIndex = Math.min(Math.max(0, Math.floor(scroller.scrollTop / 80) - 4), 50000 - 16);
      const expectedId = `00000000-0000-4000-8000-${String(100 + oracle[firstIndex]!).padStart(12, '0')}`;
      if (document.querySelector('tr[data-transaction-id]')?.getAttribute('data-transaction-id') !== expectedId) throw new Error('Scrollposition zeigt eine falsche Buchung');
      if (index >= 5) { scroll.push(performance.now() - begin); counts.push(document.querySelectorAll('tr[data-transaction-id]').length); }
    }
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]!;
    return { open, filter, scroll, filterP95: p95(filter), scrollP95: p95(scroll), counts, countText: document.querySelector('.transaction-filters + p')?.textContent };
  });
  await info.attach('Messung', { body: JSON.stringify({ ...results, coldOpen, browser: browser.version(), fixture: { transactions: 50000, accounts: 10, categories: 100, months: 36, syntheticSharedExpenses: 1000 }, environment: { platform: platform(), release: release(), architecture: arch(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), ci: Boolean(process.env.CI), method: 'Vite-Testseite mit echtem IndexedDB, zwei Animationsframes bis Darstellung; 5 warme Vorläufe, 30 Messungen' } }), contentType: 'application/json' });
  expect(results.countText).toBe('50000 Buchungen'); expect(Math.max(...results.counts)).toBeLessThanOrEqual(16);
  expect(coldOpen).toBeLessThan(2000); expect(results.open).toBeLessThan(2000); expect(results.filterP95).toBeLessThan(100); expect(results.scrollP95).toBeLessThan(100);
});
