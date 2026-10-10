// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
it('DAL02-Formschemas entsprechen den 28 nativen Rust-Orakeln', () => {
  const cases = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/dal-forms.json', 'utf8')) as { name: string; schema: string; value: unknown; valid: boolean }[];
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats.default(ajv);
  ajv.addFormat('uint32', { type: 'number', validate: value => Number.isInteger(value) && value >= 0 && value <= 4_294_967_295 });
  const validators = new Map<string, ReturnType<typeof ajv.compile>>();
  for (const test of cases) {
    let check = validators.get(test.schema);
    if (!check) {
      check = ajv.compile(JSON.parse(readFileSync(`packages/contracts/generated/local-v2/schema/${test.schema}.schema.json`, 'utf8')) as object);
      validators.set(test.schema, check);
    }
    expect(check(test.value), `${test.name}: ${ajv.errorsText(check.errors)}`).toBe(test.valid);
  }
  expect(cases).toHaveLength(28);
});
