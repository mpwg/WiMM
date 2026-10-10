// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { chromium, firefox, webkit, expect, test as base, type Page } from '@playwright/test';
const engines = { chromium, firefox, webkit };
const fixture = JSON.parse(readFileSync('crates/local-dal/tests/fixtures/receipt-request.json', 'utf8')) as {
  identity: { operationContractVersion: number; profileId: string; spaceId: string; epoch: string; operationId: string };
  batch: { expectedRevisions: { handle: string; expectedRevision: number }[]; aggregates: { revision: number }[]; outbox: { operationId: string; draft: unknown }[]; projections: unknown[] };
};
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function request(profile: string, operation = 30, revision = 1) {
  const r = structuredClone(fixture); r.identity.profileId = profile; r.identity.operationId = id(operation);
  r.batch.aggregates[0]!.revision = revision; r.batch.expectedRevisions[0]!.expectedRevision = revision - 1;
  r.batch.outbox[0]!.operationId = id(operation + 100); return r;
}
const test = base.extend({ context: async ({ browserName }, provide) => {
  const directory = await mkdtemp(resolve('test-results/ar04/profile-'));
  const context = await engines[browserName].launchPersistentContext(directory);
  try { await provide(context); } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
} });
declare global { interface Window {
  receiptProofStatus: string;
  receiptProof: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  receiptProofClose: () => void;
} }
const route = (profile: string) => `/tests/local-receipts.html?profile=${profile}&wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/ar04/wasm/wimm_local_dal.js')}`)}`;
async function open(page: Page, profile: string) {
  await page.goto(route(profile)); await expect.poll(() => page.evaluate(() => window.receiptProofStatus)).toBe('ready');
}
const call = (page: Page, input: Record<string, unknown>) => page.evaluate(r => window.receiptProof(r), input);
const initialize = (page: Page) => call(page, { method: 'initialize', spaceId: id(2), proposedEpoch: id(3) });
const inspect = (page: Page) => call(page, { method: 'inspect', handle: id(4), spaceId: id(2) });
test('OPFS: Receipt, Originaloutbox und Projektionen nach Antwortverlust; genau ein Write', async ({ page }) => {
  const profile = randomUUID(); await open(page, profile); await initialize(page); const original = request(profile);
  expect((await call(page, { method: 'commit', request: original, loseResponse: true })).status).toBe('unknown');
  const receipt = await call(page, { method: 'lookup', identity: original.identity });
  expect(await call(page, { method: 'commit', request: original })).toEqual({ status: 'committed', value: receipt });
  const state = await inspect(page);
  expect(state).toEqual({ aggregate: fixture.batch.aggregates[0], pending: original.batch.outbox, projections: original.batch.projections });
  expect((await call(page, { method: 'commit', request: request(profile, 30, 2) })).error).toMatchObject({ code: 'OPERATION_ID_REUSED' });
  expect(await inspect(page)).toEqual(state);
});
test('OPFS: echter Rollback vor Receipt erhält alle vier Speicherteile', async ({ page }) => {
  const profile = randomUUID(); await open(page, profile); await initialize(page); const original = request(profile);
  expect((await call(page, { method: 'commit', request: original, failBeforeReceipt: true })).status).toBe('notCommitted');
  expect(await call(page, { method: 'lookup', identity: original.identity })).toBeNull();
  expect(await inspect(page)).toEqual({ aggregate: null, pending: [], projections: [] });
  expect((await call(page, { method: 'commit', request: original })).status).toBe('committed');
});
test('OPFS: stale CAS, fremdes Profil und Epoche erlauben keinen zusätzlichen Write', async ({ page }) => {
  const profile = randomUUID(); await open(page, profile); await initialize(page);
  expect((await call(page, { method: 'commit', request: request(profile) })).status).toBe('committed');
  expect((await call(page, { method: 'commit', request: request(profile, 31) })).error).toMatchObject({ code: 'REVISION_CONFLICT' });
  const before = await inspect(page);
  for (const field of ['profileId', 'spaceId', 'epoch'] as const) {
    const wrong = request(profile, 32, 2); wrong.identity[field] = randomUUID();
    expect((await call(page, { method: 'commit', request: wrong })).status).toBe('notCommitted');
  }
  expect(await inspect(page)).toEqual(before);
});
test('Tatsächlicher Browserprozessneustart löst verlorenes Ergebnis aus dauerhafter SQLite auf', async ({ browserName }) => {
  const profile = randomUUID(); const directory = await mkdtemp(resolve('test-results/ar04/profile-'));
  const engine = engines[browserName]; let context = await engine.launchPersistentContext(directory);
  try {
    const page = context.pages()[0] ?? await context.newPage(); await open(page, profile); await initialize(page); const original = request(profile);
    expect((await call(page, { method: 'commit', request: original, loseResponse: true })).status).toBe('unknown');
    const before = await inspect(page); await context.close(); context = await engine.launchPersistentContext(directory);
    const after = context.pages()[0] ?? await context.newPage(); await open(after, profile);
    const receipt = await call(after, { method: 'lookup', identity: original.identity });
    expect(await call(after, { method: 'commit', request: original })).toEqual({ status: 'committed', value: receipt });
    expect(await inspect(after)).toEqual(before);
  } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
});
