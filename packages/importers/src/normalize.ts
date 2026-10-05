// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseFinanceDate, parseMoney } from '@wimm/domain';
import type { CanonicalImportRecord, ImportIssue, NormalizationResult } from './types.js';

/** Keine Buchung: ungültige Vorschläge bleiben ausdrücklich fehlerhaft. */
export function normalizeImportRecord(input: CanonicalImportRecord): NormalizationResult {
  const issues: ImportIssue[] = [];
  if (!Number.isSafeInteger(input.sourceRow) || input.sourceRow < 1 || input.sourceRow > 100_000) {
    issues.push({ code: 'INVALID_RECORD', field: 'sourceRow', message: 'Die Quellzeile ist ungültig.' });
  }
  if (input.currency !== 'EUR') {
    issues.push({ code: 'UNSUPPORTED_CURRENCY', sourceRow: input.sourceRow, field: 'currency', message: 'Nur EUR wird unterstützt.' });
  }
  let date: string | undefined;
  let amount: number | undefined;
  try { if (typeof input.date !== 'string') throw new Error(); date = parseFinanceDate(input.date); }
  catch { issues.push({ code: 'INVALID_RECORD', sourceRow: input.sourceRow, field: 'date', message: 'Das Finanzdatum ist ungültig.' }); }
  try { if (typeof input.amount !== 'string') throw new Error(); amount = parseMoney(input.amount); }
  catch { issues.push({ code: 'INVALID_RECORD', sourceRow: input.sourceRow, field: 'amount', message: 'Der Betrag ist kein gültiger sicherer Centwert.' }); }
  if (issues.length || date === undefined || amount === undefined) return { record: null, issues };
  return { record: { ...input, date, amount, currency: 'EUR' }, issues: [] };
}
