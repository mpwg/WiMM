// SPDX-License-Identifier: AGPL-3.0-or-later
import { createImportOutputBudget } from './output-budget.js';
import { sumMoney } from '@wimm/domain';
import { normalizeImportRecord } from './normalize.js';
import { MAX_IMPORT_RECORDS, ImportFailure } from './types.js';
import type { CanonicalImportRecord, ImportIssue, ImportNode, NormalizedImportRecord, ParseResult, SourceRecord } from './types.js';

export interface CsvMapping {
  name: string; encoding: 'utf-8' | 'windows-1252'; separator: ',' | ';' | '\t'; header: boolean;
  columns: { date: number; amount?: number; debit?: number; credit?: number; payee?: number; memo?: number; externalId?: number };
  dateFormat: 'iso' | 'dach'; decimal: ',' | '.'; thousands: '' | ',' | '.'; sign: 1 | -1;
}
export interface PreviewRow { source: SourceRecord; record: NormalizedImportRecord | null; issues: ImportIssue[]; raw?: CanonicalImportRecord }
export function validateCsvMapping(mapping: CsvMapping): void {
  if (!mapping.name.trim() || !['utf-8', 'windows-1252'].includes(mapping.encoding) || ![',', ';', '\t'].includes(mapping.separator) || typeof mapping.header !== 'boolean' || !['iso', 'dach'].includes(mapping.dateFormat) || ![',', '.'].includes(mapping.decimal) || !['', ',', '.'].includes(mapping.thousands) || mapping.decimal === mapping.thousands || ![1, -1].includes(mapping.sign)) throw new Error('Die CSV-Vorlage ist ungültig.');
  for (const [key, index] of Object.entries(mapping.columns)) if (!['date', 'amount', 'debit', 'credit', 'payee', 'memo', 'externalId'].includes(key) || !Number.isSafeInteger(index) || index < 0) throw new Error('Die Spaltenzuordnung ist ungültig.');
  if (mapping.columns.date === undefined || (mapping.columns.amount === undefined && (mapping.columns.debit === undefined || mapping.columns.credit === undefined)) || (mapping.columns.amount !== undefined && (mapping.columns.debit !== undefined || mapping.columns.credit !== undefined))) throw new Error('Bitte entweder Betrag oder Soll/Haben vollständig zuordnen.');
}
function numberText(value: string, mapping: CsvMapping): string {
  const text = value.trim();
  const decimal = mapping.decimal === '.' ? '\\.' : ',';
  const thousands = mapping.thousands === '.' ? '\\.' : mapping.thousands;
  if (mapping.decimal === mapping.thousands) throw new Error('Dezimal- und Tausendertrennzeichen müssen verschieden sein.');
  const integer = thousands ? `(?:\\d+|\\d{1,3}(?:${thousands}\\d{3})+)` : '\\d+';
  if (!new RegExp(`^[+-]?${integer}(?:${decimal}\\d{1,2})?$`).test(text)) throw new Error('Der Betrag entspricht nicht dem gewählten Zahlenformat.');
  return (mapping.thousands ? text.split(mapping.thousands).join('') : text).replace(mapping.decimal, '.');
}
function nodeChildren(node: ImportNode, name: string): ImportNode[] { return node.children.filter(child => child.name === name && child.namespace === node.namespace); }
function descendants(node: ImportNode, name: string): ImportNode[] { return [...nodeChildren(node, name), ...node.children.filter(child => child.namespace === node.namespace).flatMap(child => descendants(child, name))]; }
function value(node: ImportNode, name: string): string { return descendants(node, name)[0]?.text.trim() ?? ''; }
function camtMagnitude(node: ImportNode, indicator: string): string {
  const magnitude = node.text.trim();
  if (!/^\+?\d+(?:\.\d{1,2})?$/.test(magnitude)) throw new Error('CAMT-Beträge benötigen eine nichtnegative Magnitude.');
  return `${indicator === 'DBIT' ? '-' : ''}${magnitude.replace(/^\+/, '')}`;
}
function result(source: SourceRecord, raw: Parameters<typeof normalizeImportRecord>[0]): PreviewRow {
  const normalized = normalizeImportRecord(raw);
  return { source, raw, record: source.issues.length ? null : normalized.record, issues: [...source.issues, ...normalized.issues] };
}
export function createImportPreview(parsed: ParseResult, mapping?: CsvMapping): PreviewRow[] {
  if (parsed.format === 'csv') { if (!mapping) throw new Error('Die CSV-Zuordnung fehlt.'); validateCsvMapping(mapping); }
  const rows: PreviewRow[] = [];
  const outputBudget = parsed.format === 'camt053' ? createImportOutputBudget() : () => {};
  const push = (row: PreviewRow): void => { outputBudget(row); if (rows.length >= MAX_IMPORT_RECORDS) throw new ImportFailure({ code: 'RECORD_LIMIT', message: 'Mehr als 100.000 normalisierte Buchungen.' }); rows.push(row); };
  for (const source of parsed.records) {
    if (parsed.format === 'csv' && mapping?.header && source.sourceRow === 1) continue;
    try {
      if (parsed.format === 'csv') {
        if (!mapping || !source.cells) throw new Error('Eine vollständige CSV-Zuordnung ist erforderlich.');
        const cell = (index?: number) => index === undefined ? '' : source.cells?.[index] ?? '';
        let date = cell(mapping.columns.date).trim();
        if (mapping.dateFormat === 'dach') { const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date); if (!match) throw new Error('Das Datum muss DD.MM.YYYY entsprechen.'); date = `${match[3]}-${match[2]}-${match[1]}`; }
        let amount: string;
        if (mapping.columns.amount !== undefined) amount = numberText(cell(mapping.columns.amount), mapping);
        else {
          if (mapping.columns.debit === undefined || mapping.columns.credit === undefined) throw new Error('Soll und Haben müssen beide zugeordnet sein.');
          const debit = numberText(cell(mapping.columns.debit).trim() || '0', mapping);
          const credit = numberText(cell(mapping.columns.credit).trim() || '0', mapping);
          const d = normalizeImportRecord({ sourceRow: source.sourceRow, date, amount: debit, currency: 'EUR' });
          const c = normalizeImportRecord({ sourceRow: source.sourceRow, date, amount: credit, currency: 'EUR' });
          if (!d.record || !c.record || d.record.amount < 0 || c.record.amount < 0) throw new Error('Soll und Haben benötigen nichtnegative Beträge.');
          if (d.record.amount !== 0 && c.record.amount !== 0) throw new Error('Soll und Haben sind gleichzeitig gefüllt.');
          amount = d.record.amount ? `-${debit.replace(/^\+/, '')}` : credit;
        }
        if (mapping.sign === -1) amount = amount.startsWith('-') ? amount.slice(1) : `-${amount.replace(/^\+/, '')}`;
        push(result(source, { sourceRow: source.sourceRow, date, amount, currency: 'EUR', payee: cell(mapping.columns.payee), memo: cell(mapping.columns.memo), externalId: cell(mapping.columns.externalId) }));
      } else if (parsed.format === 'camt053') {
        const entry = source.node;
        if (!entry || !entry.namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.053.')) throw new Error('Der CAMT.053-Namespace ist ungültig.');
        const amountNode = nodeChildren(entry, 'Amt')[0];
        const sign = nodeChildren(entry, 'CdtDbtInd')[0]?.text.trim();
        if (!amountNode || !['CRDT', 'DBIT'].includes(sign ?? '')) throw new Error('Der CAMT-Betrag oder das Vorzeichen fehlt.');
        const booking = nodeChildren(entry, 'BookgDt')[0];
        const date = booking ? value(booking, 'Dt') || value(booking, 'DtTm').slice(0, 10) : '';
        const currency = amountNode.attributes.Ccy ?? '';
        const amount = camtMagnitude(amountNode, sign!);
        const base = normalizeImportRecord({ sourceRow: source.sourceRow, date, amount, currency });
        if (!base.record) { push(result(source, { sourceRow: source.sourceRow, date, amount, currency })); continue; }
        const details = descendants(entry, 'TxDtls');
        const detailAmounts = details.map(detail => {
          const txAmount = descendants(detail, 'TxAmt')[0];
          const node = txAmount ? nodeChildren(txAmount, 'Amt')[0] : nodeChildren(detail, 'Amt')[0];
          for (const amount of descendants(detail, 'Amt')) camtMagnitude(amount, sign!);
          if (!node) return null;
          const normalized = normalizeImportRecord({ sourceRow: source.sourceRow, date, amount: camtMagnitude(node, sign!), currency: node.attributes.Ccy ?? currency });
          if (!normalized.record) throw new Error('Ein CAMT-Detailbetrag ist ungültig.');
          return normalized.record;
        });
        if (details.some(detail => descendants(detail, 'Amt').some(node => node.attributes.Ccy && node.attributes.Ccy !== 'EUR'))) throw new Error('Nicht-EUR-Detailbeträge sind nicht erlaubt.');
        const split = details.length > 1 && detailAmounts.every(item => item !== null) && sumMoney(detailAmounts.map(item => item!.amount)) === base.record.amount;
        if (split) details.forEach((detail, index) => push({ source, record: { ...detailAmounts[index]!, sourceRow: rows.length + 1, memo: descendants(detail, 'Ustrd').map(item => item.text).join(' '), externalId: value(detail, 'AcctSvcrRef') }, issues: [] }));
        else push({ source, record: { ...base.record, memo: `${details.length > 1 ? 'Sammelbuchung: ' : ''}${descendants(entry, 'Ustrd').map(item => item.text).join(' ')}`, externalId: value(entry, 'AcctSvcrRef') || nodeChildren(entry, 'NtryRef')[0]?.text || '' }, issues: [] });
      } else {
        const fields = source.fields ?? {};
        const text = (key: string) => { const entry = fields[key]; if (entry === undefined) return ''; if (typeof entry !== 'string') throw new Error('Ein OFX-Feld muss Text enthalten.'); return entry; };
        const posted = text('DTPOSTED');
        if (!/^\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.test(posted)) throw new Error('Das OFX-Buchungsdatum ist ungültig.');
        push(result(source, { sourceRow: source.sourceRow, date: `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`, amount: text('TRNAMT'), currency: source.currency ?? '', payee: text('NAME') || (typeof fields.PAYEE === 'string' ? fields.PAYEE : ''), memo: text('MEMO'), externalId: text('FITID') }));
      }
    } catch (error) { if (error instanceof ImportFailure) throw error; push({ source, record: null, issues: [{ code: 'INVALID_RECORD', sourceRow: source.sourceRow, message: error instanceof Error ? error.message : 'Die Zeile ist ungültig.' }] }); }
    if (rows.length > MAX_IMPORT_RECORDS) throw new ImportFailure({ code: 'RECORD_LIMIT', message: 'Mehr als 100.000 normalisierte Buchungen.' });
  }
  // Quellreferenzen müssen auch nach CAMT-Vereinzelung eindeutig sein.
  return rows.map((row, index) => ({ ...row, source: { ...row.source, originalSourceRow: row.source.sourceRow, sourceRow: index + 1 }, record: row.record ? { ...row.record, sourceRow: index + 1 } : null }));
}
