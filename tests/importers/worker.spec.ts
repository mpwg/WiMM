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

test('Echter Worker erhält 100.000 normalisierte CAMT-Zeilen innerhalb der unveränderten Prüfgrenze',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async url=>{
  const {port}=await import(/* @vite-ignore */ url) as {port:ImportWorkerPort};
  const entry='<Ntry><Amt Ccy="EUR">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-07</Dt></BookgDt><NtryRef>synthetisch</NtryRef></Ntry>';
  const bytes=new TextEncoder().encode('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">'+entry.repeat(100000)+'</Document>');
  const start=performance.now();const parsed=await port.parse({bytes,format:'camt053',preview:true});
  return {milliseconds:performance.now()-start,records:parsed.records.length,preview:parsed.preview?.length,first:parsed.preview?.[0]?.record,last:parsed.preview?.at(-1)?.record};
 },harness);
 expect(result.records).toBe(100000);expect(result.preview).toBe(100000);
 expect(result.first).toMatchObject({sourceRow:1,date:'2026-10-07',amount:100,currency:'EUR'});
 expect(result.last).toMatchObject({sourceRow:100000,date:'2026-10-07',amount:100,currency:'EUR'});
 expect(result.milliseconds).toBeLessThan(15000);
});
