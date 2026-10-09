// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
import type * as Binding from '../generated/local-v2/wasm/wimm_local_contracts.js';
it('Alle elf lokalen Portanfragen haben typisierte versionsgebundene Formen ohne Backendfallback', async () => {
  const catalog = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/port-forms.json', 'utf8')) as { cases: { name: string; request: unknown; valid: boolean }[] };
  expect(catalog.cases).toHaveLength(15);
  const probe = spawnSync(resolve('target/debug/wimm-contract-schema'), ['--probe-local-port-v2'], { input: catalog.cases.map(c => JSON.stringify(c.request)).join('\n') + '\n', encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr); const rust = probe.stdout.trim().split(/\r?\n/).map((s: string) => (JSON.parse(s) as { valid: boolean }).valid);
  const wasm = await import(/* @vite-ignore */ pathToFileURL(resolve('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts.js')).href) as typeof Binding;
  wasm.initSync({ module: readFileSync('test-results/contract-bindings-generation/local-wasm/wimm_local_contracts_bg.wasm') });
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats.default(ajv);
  ajv.addFormat('uint32', { type: 'number', validate: value => Number.isInteger(value) && value >= 0 && value <= 4_294_967_295 });
  const schema = ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/local-v2/schema/local-port-request.schema.json', 'utf8')) as object);
  for (const [index, c] of catalog.cases.entries()) {
    assert.equal(rust[index], c.valid, c.name); assert.equal(schema(c.request), c.valid, c.name);
    let actual: boolean;
    try { assert.deepEqual(wasm.validate_local_port_form_v2(c.request as Binding.LocalPortRequestV2), { contractVersion: 2, status: 'formValid' }); actual = true; }
    catch (error) { assert.ok(typeof error === 'object' && error !== null && 'contractVersion' in error && error.contractVersion === 2); actual = false; }
    assert.equal(actual, c.valid, c.name);
  }
});
