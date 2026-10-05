// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import type { ImportWorkerPort } from '../../packages/importers/src/index.js';
const harness = '/@fs' + process.cwd() + '/packages/importers/tests/worker-harness.ts';

test('Echter Worker: lokal parsen, strukturiert ablehnen, abbrechen und danach neu starten', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (['xhr', 'fetch'].includes(request.resourceType()) || request.method() !== 'GET') requests.push(request.url()); });
  await page.goto('/');
  const result = await page.evaluate(async (url) => {
    const { port, abortRunningImport } = await import(/* @vite-ignore */ url) as { port: ImportWorkerPort; abortRunningImport: () => Promise<string> };
    const activeAbort = await abortRunningImport();
    const bytes = new TextEncoder().encode('Datum;Betrag\n2028-02-29;-0,01');
    const parsed = await port.parse({ bytes, format: 'csv' });
    const controller = new AbortController();
    const running = port.parse({ bytes: new TextEncoder().encode('a\n'.repeat(100_000)), format: 'csv' }, controller.signal);
    controller.abort();
    let aborted = false;
    try { await running; } catch (error) { aborted = (error as { issue: { code: string } }).issue.code === 'ABORTED'; }
    let rejected = false;
    try { await port.parse({ bytes: new TextEncoder().encode('<Document><broken></Document>'), format: 'camt053' }); }
    catch (error) { rejected = (error as { issue: { code: string } }).issue.code === 'INVALID_FILE'; }
    const again = await port.parse({ bytes, format: 'csv' });
    return { parsed, aborted, rejected, again, activeAbort };
  }, harness);
  expect(result.parsed.records[1]?.cells).toEqual(['2028-02-29', '-0,01']);
  expect(result.activeAbort).toBe('ABORTED');
  expect(result.aborted).toBe(true); expect(result.rejected).toBe(true);
  expect(result.again).toEqual(result.parsed);
  expect(requests).toEqual([]);
});
