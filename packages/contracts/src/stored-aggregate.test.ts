// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { storedFinancialAggregateSchema } from './financial-aggregates.js';
it('Gespeicherte Aggregate erhalten alle 14 Formen und verlangen Handle ohne Zusatzfelder', () => {
  const catalog = JSON.parse(readFileSync('crates/local-contracts/tests/fixtures/snapshot-forms.json', 'utf8')) as { cases: { name: string; request: { aggregates: Record<string, unknown>[] } }[] };
  const cases = catalog.cases.filter(c => c.name.startsWith('Flaches Aggregat '));
  expect(cases).toHaveLength(14);
  for (const c of cases) {
    const aggregate = c.request.aggregates[0]!;
    expect(storedFinancialAggregateSchema.parse(aggregate)).toEqual(aggregate);
    expect(storedFinancialAggregateSchema.safeParse({ ...aggregate, surprise: true }).success).toBe(false);
    const missing = { ...aggregate }; delete missing.handle;
    expect(storedFinancialAggregateSchema.safeParse(missing).success).toBe(false);
  }
});
