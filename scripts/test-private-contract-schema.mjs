// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { callTypedCommand, mutateCommandFixture } from '../tests/contract-bindings/command-wasm.ts';
import { callTypedState, stateFixtureFromV1 } from '../tests/contract-bindings/state-wasm.ts';

const root = resolve('packages/contracts/generated/private-v2/schema');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.bindingVersion, 2);
assert.equal(manifest.domainSchemaVersion, 1);
assert.equal(manifest.exports.length, 5);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: 'full' });
// Schemars beschreibt Rust-u32 zusätzlich durch Typ, Minimum und Maximum.
ajv.addFormat('uint32', { type: 'number', validate: (value) => Number.isInteger(value) && value >= 0 && value <= 4_294_967_295 });
const validators = new Map();
for (const name of manifest.files) validators.set(name, ajv.compile(JSON.parse(await readFile(resolve(root, name), 'utf8'))));
const actions = new Map(manifest.exports.map((entry) => [entry.name.replace(/_v2$/, ''), entry]));
const catalog = JSON.parse(await readFile('crates/finance-core/tests/fixtures/contract-catalog.json', 'utf8')).filter((scenario) => actions.has(scenario.method));
assert.equal(catalog.length, 380);
const cases = catalog.map((scenario) => {
  let request;
  try { request = stateFixtureFromV1(scenario.request); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; request = null; }
  return { ...scenario, request };
});
const negatives = JSON.parse(await readFile('crates/finance-bindings/tests/fixtures/command-v2-negative.json', 'utf8'));
for (const scenario of negatives) cases.push({ ...scenario, method: 'execute', request: mutateCommandFixture(scenario.request, scenario.mode), valid: false });
const forms = JSON.parse(await readFile('crates/finance-bindings/tests/fixtures/command-v2-forms.json', 'utf8'));
for (const scenario of forms) cases.push({ ...scenario, method: 'execute', valid: false });

// Eindeutige Formorakel ergänzen den unveränderten Fachkatalog; keine Finanzregeln.
const project = { contractVersion: 2, domainSchemaVersion: 1, spaceId: '40000000-0000-4000-8000-000000000000', aggregates: [] };
for (const [name, id, valid] of [
  ['nil', '00000000-0000-0000-0000-000000000000', true],
  ['max', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', true],
  ['v8', 'ABCDEF00-0000-8000-8000-000000000001', true],
  ['version9', 'abcdef00-0000-9000-8000-000000000001', false],
  ['variant0', 'abcdef00-0000-4000-0000-000000000001', false],
  ['unicode', 'privat – ungültig 🏠', false]
]) cases.push({ name: `UUID ${name}`, method: 'project', request: { ...project, spaceId: id }, valid });
for (const [field, value] of [['contractVersion', 1], ['contractVersion', 99], ['domainSchemaVersion', 0], ['domainSchemaVersion', 99]]) cases.push({ name: `Header ${field} ${value}`, method: 'project', request: { ...project, [field]: value }, valid: false });
cases.push({ name: 'Header ohne Bindingversion', method: 'project', request: { domainSchemaVersion: 1, spaceId: project.spaceId, aggregates: [] }, valid: false });
cases.push({ name: 'Zusatzfeld', method: 'project', request: { ...project, surprise: true }, valid: false });
const command = structuredClone(cases.find((scenario) => scenario.method === 'execute').request);
for (const [time, valid] of [
  ['2026-10-09T00:00:00Z', true], ['2026-10-09T23:59:59.123456Z', true],
  ['2026-10-09T24:00:00Z', false], ['2026-10-09T23:59:60Z', false],
  ['2026-10-09T00:00:00+02:00', false], ['2026-10-09T00:00Z', false],
  ['1900-02-29T00:00:00Z', false], ['2000-02-29T00:00:00Z', true]
]) cases.push({ name: `UTC ${time}`, method: 'execute', request: { ...command, context: { ...command.context, occurredAt: time } }, valid });
for (const [date, valid] of [['0000-02-29', true], ['2000-02-29', true], ['1900-02-29', false], ['2028-04-31', false], ['9999-12-31', true], ['２０２８-02-29', false]]) cases.push({ name: `Datum ${date}`, method: 'calculate', request: { contractVersion: 2, domainSchemaVersion: 1, spaceId: project.spaceId, calculationType: 'schedule.dueDates', scheduleId: project.spaceId, aggregates: [], through: date }, valid });
const reverse = structuredClone(cases.find((scenario) => scenario.method === 'reverse').request);
const target = { id: reverse.targets[0].id };
cases.push({ name: 'previous abwesend', method: 'reverse', request: { ...reverse, targets: [target] }, valid: true });
cases.push({ name: 'previous null', method: 'reverse', request: { ...reverse, targets: [{ ...target, previous: null }] }, valid: false });
cases.push({ name: 'targets leer', method: 'reverse', request: { ...reverse, targets: [] }, valid: false });

const probe = spawnSync(resolve('target/debug', process.platform === 'win32' ? 'wimm-contract-schema.exe' : 'wimm-contract-schema'), ['--probe-private-v2'], {
  input: cases.map((scenario) => JSON.stringify({ action: scenario.method, request: scenario.request })).join('\n') + '\n', encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
});
assert.equal(probe.status, 0, probe.stderr);
assert.equal(probe.stderr, '');
const rust = probe.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line).valid);
assert.equal(rust.length, cases.length);
const wasmRoot = resolve('test-results/contract-bindings-generation/wasm');
const wasm = await import(pathToFileURL(resolve(wasmRoot, 'wimm_core_bindings.js')).href);
wasm.initSync({ module: await readFile(resolve(wasmRoot, 'wimm_core_bindings_bg.wasm')) });
const counts = { catalogFormAccepted: 0, catalogFormRejected: 0, explicitFormCases: cases.length - catalog.length };
for (const [index, scenario] of cases.entries()) {
  const entry = actions.get(scenario.method);
  const schema = validators.get(entry.request);
  assert.equal(schema(scenario.request), rust[index], `${scenario.name}: Schema/Rust-Formdifferenz ${JSON.stringify(schema.errors)}`);
  if (scenario.valid !== undefined) assert.equal(rust[index], scenario.valid, `${scenario.name}: explizites Formorakel`);
  if (index < catalog.length) counts[rust[index] ? 'catalogFormAccepted' : 'catalogFormRejected'] += 1;
  const output = scenario.method === 'execute' ? callTypedCommand(wasm, scenario.request) : callTypedState(wasm, scenario.method, scenario.request);
  if (scenario.expected !== undefined) assert.deepEqual(output, scenario.expected, `${scenario.name}: unverändertes Fachorakel`);
  const v2 = output.status === 'rejected' ? { contractVersion: 2, code: output.error.code, detail: output.error.message } : { ...output, contractVersion: 2 };
  const resultSchema = validators.get(output.status === 'rejected' ? entry.error : entry.result);
  assert.equal(resultSchema(v2), true, `${scenario.name}: Ergebnis-/Fehlerschema ${JSON.stringify(resultSchema.errors)}`);
  assert.equal(resultSchema({ ...v2, contractVersion: 1 }), false, `${scenario.name}: falsche Ergebnisversion`);
  assert.equal(resultSchema({ ...v2, surprise: true }), false, `${scenario.name}: Zusatzfeld im Ergebnis`);
}
// Vollständige unveränderte V1-Ergebnisse müssen auch die Rust-abgeleiteten Legacyformen erfüllen.
const legacy=new Map(manifest.compatibilityExports.map(entry=>[entry.name.replace(/_json$/,''),entry]));
for(const scenario of catalog){const entry=legacy.get(scenario.method);const validator=validators.get(entry.result);assert.equal(validator(scenario.expected),true,`${scenario.name}: V1-Ergebnis ${JSON.stringify(validator.errors)}`);assert.equal(validator({...scenario.expected,contractVersion:2}),false,`${scenario.name}: V1-Version gesperrt`);}
assert.equal(counts.catalogFormAccepted, 354);
assert.equal(counts.catalogFormRejected, 26);
await writeFile('test-results/typed-state-bindings/schema-results.json', JSON.stringify({ runtime: 'Ajv2020 + tatsächliche Rust-Serdeformen/WASM-Node', ...counts, schemaFiles: manifest.files.length }, null, 2) + '\n');
console.log(JSON.stringify(counts));
