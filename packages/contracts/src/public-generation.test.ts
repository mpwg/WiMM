// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, it } from 'vitest';
import { encryptedOperationSchema, signedKeyRosterSchema } from './public-envelopes.js';
import type * as PublicBinding from '../generated/public-v2/wasm/wimm_public_contracts.js';
type Case = { name: string; action: 'operation' | 'roster'; valid: boolean; request: unknown };
it('Öffentliche Formen: Zodreferenz, tatsächliches Rust/WASM und strukturelles Schema mit relationalem Rust-Guard', async () => {
  const catalog = JSON.parse(readFileSync('crates/public-contracts/tests/fixtures/public-forms.json', 'utf8')) as { synthetic: boolean; cases: Case[] };
  expect(catalog.synthetic).toBe(true); expect(catalog.cases).toHaveLength(42);
  const probe = spawnSync(resolve('target/debug/wimm-contract-schema'), ['--probe-public-v2'], { input: catalog.cases.map((c) => JSON.stringify(c)).join('\n') + '\n', encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr); expect(probe.stderr).toBe('');
  const rust = probe.stdout.trim().split(/\r?\n/).map((line: string) => (JSON.parse(line) as { valid: boolean }).valid);
  const wasm = await import(/* @vite-ignore */ pathToFileURL(resolve('test-results/contract-bindings-generation/public-wasm/wimm_public_contracts.js')).href) as typeof PublicBinding;
  wasm.initSync({ module: readFileSync('test-results/contract-bindings-generation/public-wasm/wimm_public_contracts_bg.wasm') });
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const operation = ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/public-v2/schema/public-operation.schema.json', 'utf8')) as object);
  const roster = ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/public-v2/schema/public-signed-roster.schema.json', 'utf8')) as object);
  let accepted = 0; let relationalRejected = 0;
  for (const [index, c] of catalog.cases.entries()) {
    assert.equal((c.action === 'operation' ? encryptedOperationSchema : signedKeyRosterSchema).safeParse(c.request).success, c.valid, c.name);
    assert.equal(rust[index], c.valid, c.name);
    let actual: boolean;
    try {
      const result = c.action === 'operation' ? wasm.validate_public_operation_form_v2(c.request as PublicBinding.EncryptedOperation) : wasm.validate_public_roster_form_v2(c.request as PublicBinding.SignedKeyRoster);
      assert.deepEqual(result, { contractVersion: 2, status: 'formValid' }); actual = true;
    } catch (error) {
      assert.ok(typeof error === 'object' && error !== null && 'contractVersion' in error && error.contractVersion === 2 && 'code' in error && ['INVALID_ENVELOPE', 'UPDATE_REQUIRED'].includes(String(error.code))); actual = false;
    }
    assert.equal(actual, c.valid, c.name);
    const structure = c.action === 'operation' ? operation(c.request) : roster(c.request);
    // Standard-JSON-Schema kann die arithmetische Relation +1 nicht ausdrücken.
    // Serde und der tatsächliche WASM-Guard prüfen sie aus derselben Rust-Quelle.
    assert.equal(structure && actual, c.valid, c.name);
    if (structure && !actual) relationalRejected += 1;
    if (actual) accepted += 1;
  }
  expect(accepted).toBe(9); expect(relationalRejected).toBe(5);
  mkdirSync('test-results/public-contracts', { recursive: true });
  writeFileSync('test-results/public-contracts/results.json', JSON.stringify({ catalogCases: 42, accepted, relationalRejected, runtimes: ['Zod-Bestandsreferenz', 'Rust nativ', 'tatsächliches unabhängiges öffentliches WASM/Node'], structuralSchemasAloneAreNotSufficient: true }, null, 2) + '\n');
});
