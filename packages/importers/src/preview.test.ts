// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { createImportPreview, parseImport, type CsvMapping } from './index.js';
const mapping: CsvMapping = { name: 'Bank', encoding: 'utf-8', separator: ';', header: true, columns: { date: 0, amount: 1, payee: 2, memo: 3, externalId: 4 }, dateFormat: 'dach', decimal: ',', thousands: '.', sign: 1 };
const csv = (text: string, options = mapping) => createImportPreview(parseImport({ bytes: new TextEncoder().encode(text), format: 'csv', separator: options.separator }), options);
const camt = (details = '', total = '10.01', currency = 'EUR', prefix = '') => `<${prefix}Document xmlns${prefix ? ':c' : ''}="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><${prefix}Ntry><${prefix}Amt Ccy="${currency}">${total}</${prefix}Amt><${prefix}CdtDbtInd>DBIT</${prefix}CdtDbtInd><${prefix}BookgDt><${prefix}Dt>2028-02-29</${prefix}Dt></${prefix}BookgDt><${prefix}NtryRef>entry</${prefix}NtryRef><${prefix}NtryDtls>${details}</${prefix}NtryDtls></${prefix}Ntry></${prefix}Document>`;
const detail = (amount: string, id: string) => `<TxDtls><AmtDtls><TxAmt><Amt Ccy="EUR">${amount}</Amt></TxAmt></AmtDtls><Refs><AcctSvcrRef>${id}</AcctSvcrRef></Refs><RmtInf><Ustrd>Äpfel</Ustrd></RmtInf></TxDtls>`;
const bank = (text: string, format: 'camt053' | 'ofx' | 'qfx') => createImportPreview(parseImport({ bytes: new TextEncoder().encode(text), format }));
describe('P5.2 CSV-Vorschau', () => {
  it('zeigt Original, Quotes/Mehrzeilen und 1.234,56 exakt', () => { const rows = csv('Datum;Betrag;Empfänger;Notiz\n29.02.2028;-1.234,56;"Bäckerei";"Öl\nÄpfel"'); expect(rows[0]?.record).toMatchObject({ date: '2028-02-29', amount: -123456, memo: 'Öl\nÄpfel' }); expect(rows[0]?.source.cells?.[1]).toBe('-1.234,56'); });
  it('wendet wiederverwendete Vorlage mit BOM und Windows-1252 an', () => { expect(csv('\uFEFFDatum;Betrag\n29.02.2028;0,01')[0]?.record?.amount).toBe(1); const bytes = Uint8Array.from([50, 57, 46, 48, 50, 46, 50, 48, 50, 56, 59, 49, 44, 48, 48, 59, 196]); expect(createImportPreview(parseImport({ bytes, format: 'csv', encoding: 'windows-1252' }), { ...mapping, header: false })[0]?.record?.payee).toBe('Ä'); });
  it('unterstützt Soll/Haben und weist gleichzeitige Beträge zurück', () => { const m = { ...mapping, columns: { date: 0, debit: 1, credit: 2 } }; expect(csv('d;s;h\n29.02.2028;1,00;\n29.02.2028;;2,00\n29.02.2028;1;2', m).map(r => r.record?.amount ?? null)).toEqual([-100, 200, null]); });
  it.each(['29.02.2027;-1', '31.01.2028;1.23,45', '31.01.2028;1e3', '31.01.2028;90.071.992.547.409,92'])('behält fehlerhafte Zeile %s ohne buchbare Daten', text => { expect(csv(`d;b\n${text}`)[0]?.record).toBeNull(); });
  it('unterstützt ISO, Tabulator, Dezimalpunkt, keine Kopfzeile und Vorzeichenumkehr', () => { expect(csv('2028-01-31\t1,234.56', { ...mapping, header: false, separator: '\t', dateFormat: 'iso', decimal: '.', thousands: ',', sign: -1 })[0]?.record?.amount).toBe(-123456); });
});
describe('P5.3 Bankformate', () => {
  it.each(['', 'c:'])('behandelt CAMT-Präfix %s unabhängig', prefix => { expect(bank(camt('', '10.01', 'EUR', prefix), 'camt053')[0]?.record).toMatchObject({ amount: -1001, date: '2028-02-29', externalId: 'entry' }); });
  it('vereinzelt Details nur bei exakter Summe', () => { const details = detail('5.01', 'a') + detail('5.00', 'b'); expect(bank(camt(details), 'camt053').map(r => r.record?.amount)).toEqual([-501, -500]); const mismatch = bank(camt(details, '11.00'), 'camt053'); expect(mismatch).toHaveLength(1); expect(mismatch[0]?.record?.memo).toContain('Sammelbuchung'); });
  it('weist Nicht-EUR und Fremdnamespace ab', () => { expect(bank(camt('', '10.01', 'USD'), 'camt053')[0]?.record).toBeNull(); expect(bank(camt().replaceAll('urn:iso:std:iso:20022:tech:xsd:camt.053.001.02', 'urn:fremd'), 'camt053')[0]?.record).toBeNull(); });
  it.each(['ofx', 'qfx'] as const)('normalisiert %s XML/SGML, FITID und Buchungsdatum ohne Zeitzonenverschiebung', format => { for (const close of [true, false]) { const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR${close ? '</CURDEF>' : '\n'}<BANKTRANLIST><STMTTRN><DTPOSTED>20280229233000.000[-5:EST]${close ? '</DTPOSTED>' : '\n'}<TRNAMT>-0.01${close ? '</TRNAMT>' : '\n'}<FITID>007${close ? '</FITID>' : '\n'}</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>999</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`; expect(bank(text, format)[0]?.record).toMatchObject({ date: '2028-02-29', amount: -1, externalId: '007' }); expect(bank(text.replace('EUR', 'USD'), format)[0]?.record).toBeNull(); } });
  it('lehnt DTD und externe Entitäten vor Normalisierung ab', () => { expect(() => bank('<!DOCTYPE x SYSTEM "https://invalid.test/a">' + camt(), 'camt053')).toThrow('DTD'); });
});

it('CAMT verwendet ausschließlich CRDT/DBIT für die Richtung und verwirft negative Magnituden', () => {
  expect(bank(camt('', '3.00').replace('DBIT', 'CRDT'), 'camt053')[0]?.record?.amount).toBe(300);
  expect(bank(camt('', '3.00'), 'camt053')[0]?.record?.amount).toBe(-300);
  for (const sign of ['CRDT', 'DBIT']) {
    expect(bank(camt('', '-3.00').replace('DBIT', sign), 'camt053')[0]?.record).toBeNull();
    expect(bank(camt(detail('-1.00', 'a') + detail('4.00', 'b'), '3.00').replace('DBIT', sign), 'camt053')[0]?.record).toBeNull();
  }
});
it('CAMT bewahrt Originalentry und physische Zeile bei mehreren Vereinzelungen', () => {
  const entry = (content: string) => camt(content, '3.00').replace(/^<Document[^>]*>/, '').replace('</Document>', '');
  const input = '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">\n' + entry(detail('1.00', 'a') + detail('2.00', 'b')) + '\n' + entry(detail('1.00', 'c') + detail('2.00', 'd')) + '</Document>';
  const rows = bank(input, 'camt053');
  expect(rows.map(r => r.source.originalSourceRow)).toEqual([1, 1, 2, 2]);
  expect(rows.map(r => r.source.sourceRow)).toEqual([1, 2, 3, 4]);
  expect(rows.map(r => r.record?.sourceRow)).toEqual([1, 2, 3, 4]);
  expect(rows[0]?.source.line).toBe(rows[1]?.source.line); expect(rows[2]?.source.line).toBe(rows[3]?.source.line); expect(rows[2]?.source.line).toBeGreaterThan(rows[0]!.source.line!);
});

it('bewahrt reguläre CAMT-Sammelbuchungen mit 300 Details unter dem Ausgabebudget', () => {
  const rows = bank(camt(Array.from({ length: 300 }, (_, i) => detail('1.00', String(i))).join(''), '300.00'), 'camt053');
  expect(rows).toHaveLength(300); expect(rows.every(r => r.record?.amount === -100 && r.source.originalSourceRow === 1)).toBe(true);
});
