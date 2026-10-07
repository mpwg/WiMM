// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, MAX_IMPORT_RECORDS, normalizeImportRecord, parseImport } from './index.js';
import type { CanonicalImportRecord, ImportFormat } from './index.js';
import { handleWorkerRequest } from './worker.js';
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const parse = (text: string, format: ImportFormat = 'csv') => parseImport({ bytes: bytes(text), format });
const canonical: CanonicalImportRecord = { sourceRow: 1, date: '2028-02-29', amount: '-1234.56', currency: 'EUR', memo: 'Synthetisch' };
const ofx = (record: string) => `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR</CURDEF><BANKTRANLIST>${record}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('Lokale Parsergrundlage P5.1', () => {
  it('erhält BOM, Quotes, Mehrzeilen und genaue Beträge als Texte mit Quellzeile', () => {
    const result = parse('\uFEFFDatum;Betrag;Notiz\r\n2028-02-29;-1234,56;"Äpfel\r\nund ""Öl"""\r\n2028-03-01;0,01;Ende\r\n');
    expect(result.records).toHaveLength(3);
    expect(result.records[1]).toMatchObject({ sourceRow: 2, line: 2, cells: ['2028-02-29', '-1234,56', 'Äpfel\r\nund "Öl"'], issues: [] });
    expect(result.records[2]?.line).toBe(4);
  });
  it('decodiert Windows-1252 nur nach expliziter Auswahl', () => {
    const input = Uint8Array.from([0xc4, 0x3b, 0x80]);
    expect(parseImport({ bytes: input, format: 'csv', encoding: 'windows-1252' }).records[0]?.cells).toEqual(['Ä', '€']);
    expect(() => parseImport({ bytes: input, format: 'csv' })).toThrow('ungültige Zeichen');
  });
  it('kennzeichnet fehlerhafte CSV-Zeilen ohne automatische Korrektur', () => {
    expect(parse('Datum;"offen').records[0]?.issues[0]?.code).toBe('INVALID_RECORD');
  });
  it('begrenzt echte Dateibytes vor der Decodierung und erlaubt genau 25 MiB', () => {
    expect(() => parseImport({ bytes: new Uint8Array(MAX_IMPORT_BYTES + 1), format: 'csv' })).toThrow('25 MiB');
    expect(parseImport({ bytes: bytes('x'.repeat(MAX_IMPORT_BYTES)), format: 'csv' }).records).toHaveLength(1);
    expect(() => parseImport({ bytes: bytes('€'.repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1)), format: 'csv' })).toThrow('25 MiB');
  });
  it('erlaubt genau 100.000 CSV-Datensätze und lehnt den nächsten während Parsing ab', () => {
    expect(parse('a\n'.repeat(MAX_IMPORT_RECORDS)).records).toHaveLength(MAX_IMPORT_RECORDS);
    expect(() => parse('a\n'.repeat(MAX_IMPORT_RECORDS + 1))).toThrow('100.000');
  });
  it('begrenzt XML-Entries und Details während SAX-Ereignissen', () => {
    expect(parse(`<Document>${'<Ntry/>'.repeat(MAX_IMPORT_RECORDS)}</Document>`, 'camt053').records).toHaveLength(MAX_IMPORT_RECORDS);
    expect(() => parse(`<Document>${'<Ntry/>'.repeat(MAX_IMPORT_RECORDS + 1)}</Document>`, 'camt053')).toThrow('100.000');
    expect(() => parse(`<Document><Ntry>${'<TxDtls/>'.repeat(MAX_IMPORT_RECORDS + 1)}</Ntry></Document>`, 'camt053')).toThrow('Ressourcenlimit');
  });
  it('erhält XML-Namespace, Attribute und Centtexte ohne numerische Koerzierung', () => {
    const result = parse('<c:Document xmlns:c="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><c:Ntry><c:Amt Ccy="EUR">90071992547409.91</c:Amt></c:Ntry></c:Document>', 'camt053');
    expect(result.records[0]?.node?.children[0]).toMatchObject({ name: 'Amt', attributes: { Ccy: 'EUR' }, text: '90071992547409.91' });
    expect(result.records[0]?.node?.namespace).toContain('camt.053');
  });
  it.each(['<!DOCTYPE Document [<!ENTITY x SYSTEM "https://invalid.test/privat">]><Document><Ntry>&x;</Ntry></Document>', '<Document><Ntry>&unknown;</Ntry></Document>', '<Document><Ntry></Document>', '<Document/>garbage'])('weist unsicheres oder defektes XML ab', text => {
    expect(() => parse(text, 'camt053')).toThrow(/DTD|XML/);
  });
  it('begrenzt XML-Tiefe', () => {
    expect(() => parse('<Document>'.repeat(129) + '</Document>'.repeat(129), 'camt053')).toThrow('zu tief');
  });
  it.each(['ofx', 'qfx'] as const)('parst %s XML und SGML ohne Verlust der Betragstexte', format => {
    const xml = ofx('<STMTTRN><DTPOSTED>20280229120000</DTPOSTED><TRNAMT>-0.01</TRNAMT><FITID>0001</FITID></STMTTRN>');
    expect(parse(xml, format).records[0]?.fields).toEqual({ DTPOSTED: '20280229120000', TRNAMT: '-0.01', FITID: '0001' });
    const sgml = ofx('<STMTTRN><DTPOSTED>20280229120000\n<TRNAMT>90071992547409.91\n<FITID>0002\n</STMTTRN>');
    expect(parse(`OFXHEADER:100\nDATA:OFXSGML\n\n${sgml}`, format).records[0]?.fields?.TRNAMT).toBe('90071992547409.91');
  });
  it('erlaubt genau 100.000 OFX-Buchungen', () => {
    expect(parse(ofx('<STMTTRN><TRNAMT>0.01</TRNAMT></STMTTRN>'.repeat(MAX_IMPORT_RECORDS)), 'ofx').records).toHaveLength(MAX_IMPORT_RECORDS);
  });
  it('bewahrt die Quellreihenfolge über mehrere OFX-Statements', () => {
    const first = '<STMTTRN><FITID>erste</FITID></STMTTRN>';
    const second = '<STMTTRN><FITID>zweite</FITID></STMTTRN>';
    const input = '<OFX>' + ofx(first).slice(5, -6) + ofx(second).slice(5, -6) + '</OFX>';
    expect(parse(input, 'ofx').records.map(row => row.fields?.FITID)).toEqual(['erste', 'zweite']);
  });
  it('weist zu viele OFX-Buchungen bereits vor dem Bibliotheksparser ab', () => {
    expect(() => parse(ofx('<STMTTRN></STMTTRN>'.repeat(MAX_IMPORT_RECORDS + 1)), 'ofx')).toThrow('100.000');
    expect(() => parse('<!DOCTYPE OFX><OFX/>', 'ofx')).toThrow('DTD');
    expect(() => parse(ofx('<STMTTRN type="a"></STMTTRN>'.repeat(MAX_IMPORT_RECORDS + 1)), 'ofx')).toThrow('100.000');
    expect(() => parse('<OFX><__proto__>x</__proto__></OFX>', 'ofx')).toThrow('Reservierte');
  });
  it('liefert bei Abbruch kein erfolgreiches Teilergebnis', () => {
    const controller = new AbortController(); controller.abort();
    expect(() => parseImport({ bytes: bytes('a'), format: 'csv' }, controller.signal)).toThrow('abgebrochen');
  });
  it('gibt strukturierte Fehler ohne Originalfinanztext zurück', () => {
    const reply = handleWorkerRequest({ bytes: bytes('<Document><GEHEIM></Document>'), format: 'camt053' });
    expect(reply).toEqual({ ok: false, issue: { code: 'INVALID_FILE', message: 'Die XML-Datei ist syntaktisch ungültig.' } });
    expect(JSON.stringify(reply)).not.toContain('GEHEIM');
  });
});

describe('Exakte Zwischenform ohne Speicheränderung', () => {
  it.each([['-1234.56', -123456], ['0.01', 1], ['90071992547409.91', Number.MAX_SAFE_INTEGER], ['-90071992547409.91', Number.MIN_SAFE_INTEGER], ['-0,01', -1]])('normalisiert %s exakt', (amount, expected) => {
    expect(normalizeImportRecord({ ...canonical, amount }).record?.amount).toBe(expected);
  });
  it.each(['90071992547409.92', '-90071992547409.92', '1.234,56', '1.001', '1e3', 'NaN', 'Infinity'])('weist ungültige oder unsichere Zwischenwerte %s ab', amount => {
    expect(normalizeImportRecord({ ...canonical, amount })).toMatchObject({ record: null, issues: [{ field: 'amount', sourceRow: 1 }] });
  });
  it('sammelt Datum-, Währungs- und Betragsfehler statt einer buchbaren Teilzeile', () => {
    const result = normalizeImportRecord({ ...canonical, date: '2027-02-29', amount: 'kaputt', currency: 'USD' });
    expect(result.record).toBeNull(); expect(result.issues).toHaveLength(3);
  });
});

it('begrenzt breite CAMT-Entries einschließlich unbekannter und fremder Felder', () => {
  for (const node of ['<X/>', '<f:X xmlns:f="urn:fremd"/>']) {
    const text = '<Document><Ntry>' + node.repeat(20_001) + '</Ntry></Document>';
    expect(() => parse(text, 'camt053')).toThrow(/Limit|Grenze/i);
  }
});

it('begrenzt die globale XML-Knotenzahl und die gespeicherte Ausgabe vor Rückgabe', () => {
  expect(() => parse('<Document>' + '<X/>'.repeat(2_000_001) + '</Document>', 'camt053')).toThrow('Ressourcenlimit');
  expect(() => parse('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.' + 'x'.repeat(1000) + '">' + '<Ntry/>'.repeat(100_000) + '</Document>', 'camt053')).toThrow('Ressourcenlimit');
});

it('erhält 100.000 reguläre CAMT-Buchungen einschließlich normalisierter Worker-Vorschau', () => {
  const entry = '<Ntry><Amt Ccy="EUR">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-07</Dt></BookgDt><NtryRef>synthetisch</NtryRef></Ntry>';
  const input = bytes('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">' + entry.repeat(MAX_IMPORT_RECORDS) + '</Document>');
  expect(input.byteLength).toBeLessThan(MAX_IMPORT_BYTES);
  const reply = handleWorkerRequest({ bytes: input, format: 'camt053', preview: true });
  expect(reply.ok).toBe(true); if (!reply.ok) throw new Error(reply.issue.message);
  expect(reply.result.preview).toHaveLength(MAX_IMPORT_RECORDS);
}, 15_000);
