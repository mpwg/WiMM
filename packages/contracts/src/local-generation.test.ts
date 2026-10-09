// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, it } from 'vitest';
import { storageMigrationPlanSchema } from './finance-engine.js';
import type * as Binding from '../generated/local-v2/wasm/wimm_local_contracts.js';
it('Lokale Migrationsformen: gemeinsames Zod-/Rust-/WASM-Orakel mit lückenlosen Versionsrelationen', async () => {
  const catalog = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/migration-forms.json', 'utf8')) as { synthetic: boolean; cases: { name: string; request: unknown; valid: boolean }[] };
  expect(catalog.synthetic).toBe(true); expect(catalog.cases).toHaveLength(20);
  const probe = spawnSync(resolve('target/debug/wimm-contract-schema'), ['--probe-local-v2'], { input: catalog.cases.map(c => JSON.stringify(c.request)).join('\n') + '\n', encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr); assert.equal(probe.stderr, '');
  const rust = probe.stdout.trim().split(/\r?\n/).map((line: string) => (JSON.parse(line) as { valid: boolean }).valid);
  const wasm = await import(/* @vite-ignore */ pathToFileURL(resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')).href) as typeof Binding;
  wasm.initSync({ module: readFileSync('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts_bg.wasm') });
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const schema = ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/local-v2/schema/local-migration-plan.schema.json', 'utf8')) as object);
  let accepted = 0; let relationalRejected = 0;
  for (const [index, c] of catalog.cases.entries()) {
    assert.equal(storageMigrationPlanSchema.safeParse(c.request).success, c.valid, c.name); assert.equal(rust[index], c.valid, c.name);
    let actual: boolean;
    try { assert.deepEqual(wasm.validate_local_migration_form_v2(c.request as Binding.StorageMigrationPlan), { contractVersion: 2, status: 'formValid' }); actual = true; }
    catch (error) { assert.ok(typeof error === 'object' && error !== null && 'contractVersion' in error && error.contractVersion === 2 && 'code' in error && error.code === 'INVALID_LOCAL_CONTRACT'); actual = false; }
    assert.equal(actual, c.valid, c.name);
    const structure = schema(c.request); assert.equal(structure && actual, c.valid, c.name);
    if (actual) accepted += 1; if (structure && !actual) relationalRejected += 1;
  }
  expect(accepted).toBe(4); expect(relationalRejected).toBe(4);
  mkdirSync('test-results/local-contracts', { recursive: true });
  writeFileSync('test-results/local-contracts/results.json', JSON.stringify({ catalogCases: 20, accepted, relationalRejected, purpose: 'reine Formprüfung ohne Speicherport' }, null, 2) + '\n');
});
