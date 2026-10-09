// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../apps/web/tests/local-wasm.js';
const catalog = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/migration-forms.json', 'utf8')) as { cases: { name: string; request: unknown; valid: boolean }[] };
test('Unabhängiges lokales WASM: 20 gemeinsame Migrationsformorakel ohne Write', async ({ page }) => {
  expect(catalog.cases).toHaveLength(20);
  await page.goto(`/tests/local-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')}`)}`);
  await page.waitForFunction(() => window.localMigrationProbe !== undefined);
  for (const c of catalog.cases) {
    const result = await page.evaluate(value => window.localMigrationProbe(value), c.request);
    if (c.valid) expect(result, c.name).toEqual({ contractVersion: 2, status: 'formValid' });
    else expect(result, c.name).toMatchObject({ contractVersion: 2, code: 'INVALID_LOCAL_CONTRACT' });
  }
});
test('Vollständiger Snapshotrundlauf und elf Portformen im unabhängigen lokalen WASM', async ({ page }) => {
  await page.goto(`/tests/local-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')}`)}`);
  await page.waitForFunction(() => window.localSnapshotProbe !== undefined);
  const snapshots = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/snapshot-forms.json', 'utf8')) as typeof catalog;
  expect(snapshots.cases).toHaveLength(40);
  for (const c of snapshots.cases) {
    const result = await page.evaluate(value => window.localSnapshotProbe(value), c.request);
    if (c.valid) expect(result, c.name).toEqual({ contractVersion: 2, status: 'snapshot', snapshot: c.request });
    else expect(result, c.name).toMatchObject({ contractVersion: 2, code: expect.any(String) });
  }
  const ports = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/port-forms.json', 'utf8')) as typeof catalog;
  expect(ports.cases).toHaveLength(15);
  for (const c of ports.cases) {
    const result = await page.evaluate(value => window.localPortProbe(value), c.request);
    if (c.valid) expect(result, c.name).toEqual({ contractVersion: 2, status: 'formValid' });
    else expect(result, c.name).toMatchObject({ contractVersion: 2, code: expect.any(String) });
  }
  const opaque = snapshots.cases.find(c => c.name.startsWith('Opaker Altentwurf'))!;
  for (const kind of ['nan', 'infinity', 'undefined', 'map', 'date', 'bigint', 'function', 'cycle']) {
    const result = await page.evaluate(({ input, kind }) => {
      const value = input as { pending: { draft: unknown }[] };
      const bad: Record<string, unknown> = { original: kind === 'nan' ? NaN : kind === 'infinity' ? Infinity : kind === 'undefined' ? undefined : kind === 'map' ? new Map() : kind === 'date' ? new Date() : kind === 'bigint' ? 1n : kind === 'function' ? (() => 1) : null };
      if (kind === 'cycle') bad.self = bad;
      value.pending[0]!.draft = bad; return window.localSnapshotProbe(value);
    }, { input: opaque.request, kind });
    expect(result).toMatchObject({ contractVersion: 2, code: 'INVALID_LOCAL_CONTRACT' });
  }
});
test('Speicherfehlercodes und Commitstatus über echtes WASM ohne Payloadleck', async ({page}) => {
  await page.goto(`/tests/local-wasm.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')}`)}`);
  await page.waitForFunction(()=>window.storageFailureProbe!==undefined);
  for (const code of ['REVISION_CONFLICT','QUOTA','RESOURCE_UNAVAILABLE','WRITE_FAILED','UPDATE_REQUIRED','EPOCH_MISMATCH','CANCELLED','COMMIT_UNKNOWN','INVALID_RESPONSE','OPERATION_ID_REUSED']) {
    const input={contractVersion:2,code,commitState:code==='COMMIT_UNKNOWN'?'unknown':'notCommitted'};
    expect(await page.evaluate(value=>window.storageFailureProbe(value),input)).toEqual(input);
  }
  for(const input of [{contractVersion:99,code:'QUOTA',commitState:'notCommitted'},{contractVersion:2,code:'COMMIT_UNKNOWN',commitState:'notCommitted'},{contractVersion:2,code:'SECRET',commitState:'notCommitted'},{contractVersion:2,code:'QUOTA',commitState:'notCommitted',payload:'secret'}]) {
    expect(await page.evaluate(value=>window.storageFailureProbe(value),input)).toEqual({contractVersion:2,code:'INVALID_LOCAL_CONTRACT',detail:'Die lokale Vertragsform ist ungültig.'});
  }
});
