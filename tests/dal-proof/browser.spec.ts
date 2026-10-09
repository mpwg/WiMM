// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { chromium, firefox, webkit, expect, test as base, type Page } from '@playwright/test';

const engines = { chromium, firefox, webkit };
// OPFS wird mit tatsächlichen dauerhaften Browserprofilen abgenommen. WebKit
// verweigert SyncAccessHandle im flüchtigen/privaten Standardtestkontext.
const test = base.extend({
  context: async ({ browserName }, provide) => {
    const directory = await mkdtemp(resolve('test-results/dal-proof/profile-'));
    const context = await engines[browserName].launchPersistentContext(directory);
    try { await provide(context); }
    finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
  }
});

declare global {
  interface Window {
    dalProofStatus: string;
    dalProof: (request: Record<string, unknown>) => Promise<{ ok: boolean; code?: string; value?: unknown }>;
    dalProofClose: () => void;
    dalProofCrash: () => void;
  }
}
const path = (scope: string) => `/tests/dal-proof.html?scope=${scope}&wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/dal-proof/wasm/wimm_dal_proof.js')}`)}`;
async function open(page: Page, scope: string) {
  await page.goto(path(scope));
  await expect.poll(() => page.evaluate(() => window.dalProofStatus)).toBe('ready');
}
const call = (page: Page, request: Record<string, unknown>) => page.evaluate(input => window.dalProof(input), request);

test('Echter OPFS-DAL: vollständiger Batch, CAS, Fehlerrollback und explizite DSLmigration', async ({ page }) => {
  await open(page, randomUUID());
  expect((await call(page, { kind: 'initialize' })).ok).toBe(true);
  expect((await call(page, { kind: 'batch', id: 'alpha', expected: 0, value: 'eins', fail: false })).ok).toBe(true);
  const original = await call(page, { kind: 'snapshot' });
  expect((await call(page, { kind: 'batch', id: 'alpha', expected: 0, value: 'veraltet', fail: false })).code).toBe('REVISION_CONFLICT');
  expect((await call(page, { kind: 'batch', id: 'alpha', expected: 1, value: 'unvollständig', fail: true })).code).toBe('INJECTED_ROLLBACK');
  expect(await call(page, { kind: 'snapshot' })).toEqual(original);
  expect((await call(page, { kind: 'migrate', expected: 1, fail: true })).code).toBe('INJECTED_ROLLBACK');
  expect(await call(page, { kind: 'snapshot' })).toEqual(original);
  expect((await call(page, { kind: 'migrate', expected: 1, fail: false })).ok).toBe(true);
  expect((await call(page, { kind: 'query', value: 'eins' })).value).toEqual([{ id: 'alpha', revision: 1, value: 'eins' }]);
  expect((await call(page, { kind: 'snapshot' })).value).toEqual({ entities: [{ id: 'alpha', revision: 1, value: 'eins' }], outbox: [{ id: 'alpha:1', entity_id: 'alpha' }], projections: [{ id: 'alpha', value: 'eins' }], migrations: [1, 2] });
});

test('Echte Tabs: ein Besitzer, stale CAS und Übernahme nach Schließen', async ({ context, page }) => {
  const scope = randomUUID(); await open(page, scope); await call(page, { kind: 'initialize' });
  expect((await call(page, { kind: 'batch', id: 'race', expected: 0, value: 'erstes Tab', fail: false })).ok).toBe(true);
  const second = await context.newPage(); await second.goto(path(scope));
  await expect.poll(() => second.evaluate(() => window.dalProofStatus)).toBe('waiting');
  await page.close();
  await expect.poll(() => second.evaluate(() => window.dalProofStatus)).toBe('ready');
  expect((await call(second, { kind: 'batch', id: 'race', expected: 0, value: 'stale', fail: false })).code).toBe('REVISION_CONFLICT');
  expect((await call(second, { kind: 'batch', id: 'race', expected: 1, value: 'übernommen', fail: false })).ok).toBe(true);
});

test('Tatsächlicher Browserprozessneustart erhält OPFS und Journal', async ({ browserName }) => {
  const scope = randomUUID();
  const directory = await mkdtemp(resolve('test-results/dal-proof/profile-'));
  const engine = engines[browserName];
  let context = await engine.launchPersistentContext(directory);
  try {
    const page = context.pages()[0] ?? await context.newPage(); await open(page, scope);
    await call(page, { kind: 'initialize' });
    expect((await call(page, { kind: 'batch', id: 'restart', expected: 0, value: 'dauerhaft', fail: false })).ok).toBe(true);
    await call(page, { kind: 'migrate', expected: 1, fail: false });
    const before = await call(page, { kind: 'snapshot' }); await context.close();
    context = await engine.launchPersistentContext(directory);
    const after = context.pages()[0] ?? await context.newPage(); await open(after, scope);
    expect(await call(after, { kind: 'snapshot' })).toEqual(before);
  } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Workerfehler gibt Besitz frei und erhält den bestätigten Stand', async ({ context, page }) => {
  const scope = randomUUID(); await open(page, scope); await call(page, { kind: 'initialize' });
  await call(page, { kind: 'batch', id: 'crash', expected: 0, value: 'bestätigt', fail: false });
  const original = await call(page, { kind: 'snapshot' });
  const second = await context.newPage(); await second.goto(path(scope));
  await expect.poll(() => second.evaluate(() => window.dalProofStatus)).toBe('waiting');
  await page.evaluate(() => window.dalProofCrash());
  await expect.poll(() => page.evaluate(() => window.dalProofStatus)).toBe('error');
  await expect.poll(() => second.evaluate(() => window.dalProofStatus)).toBe('ready');
  expect(await call(second, { kind: 'snapshot' })).toEqual(original);
});

test('Origin-Rückkehr ohne COOP/COEP erhält DB; keine behauptete OIDC-Authentifizierung', async ({ page }) => {
  const scope = randomUUID(); await open(page, scope); await call(page, { kind: 'initialize' });
  const response = await page.request.get(path(scope));
  expect(response.headers()['cross-origin-opener-policy']).toBeUndefined();
  expect(response.headers()['cross-origin-embedder-policy']).toBeUndefined();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await call(page, { kind: 'batch', id: 'return', expected: 0, value: 'erhalten', fail: false });
  const original = await call(page, { kind: 'snapshot' });
  const target = path(scope).replace('/tests/dal-proof.html', '/tests/dal-proof-return.html');
  await page.goto(`http://localhost:4176${target}`);
  await expect.poll(() => page.url()).toContain('http://127.0.0.1:4176/tests/dal-proof.html');
  await expect.poll(() => page.evaluate(() => window.dalProofStatus)).toBe('ready');
  expect(await call(page, { kind: 'snapshot' })).toEqual(original);
});
