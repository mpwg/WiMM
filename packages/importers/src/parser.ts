// SPDX-License-Identifier: AGPL-3.0-or-later
import Papa from 'papaparse';
import { SaxesParser } from 'saxes';
import { parseSync } from 'ofx-js';
import { ImportFailure, MAX_IMPORT_BYTES, MAX_IMPORT_RECORDS } from './types.js';
import type { ImportNode, ParseRequest, ParseResult, SourceRecord } from './types.js';

function fail(code: 'FILE_LIMIT' | 'RECORD_LIMIT' | 'ABORTED' | 'INVALID_FILE', message: string): never {
  throw new ImportFailure({ code, message });
}
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) fail('ABORTED', 'Der Import wurde abgebrochen.');
}
function checkCount(count: number): void {
  if (count > MAX_IMPORT_RECORDS) fail('RECORD_LIMIT', 'Die Datei enthält mehr als 100.000 Datensätze.');
}

/** Nur lokale Bytes; weder URL noch Dateipfad, Speicher oder Netzwerkport. Im Client ausschließlich im Worker ausführen. */
export function parseImport(request: ParseRequest, signal?: AbortSignal): ParseResult {
  checkAbort(signal);
  if (!(request.bytes instanceof Uint8Array)) fail('INVALID_FILE', 'Die Eingabe muss lokale Dateibytes enthalten.');
  if (request.bytes.byteLength > MAX_IMPORT_BYTES) fail('FILE_LIMIT', 'Die Datei ist größer als 25 MiB.');
  if (request.encoding !== undefined && !['utf-8', 'windows-1252'].includes(request.encoding)) fail('INVALID_FILE', 'Der Zeichensatz wird nicht unterstützt.');
  let text: string;
  try { text = new TextDecoder(request.encoding ?? 'utf-8', { fatal: true }).decode(request.bytes).replace(/^\uFEFF/, ''); }
  catch { return fail('INVALID_FILE', 'Die Datei enthält ungültige Zeichen für den gewählten Zeichensatz.'); }
  try {
    switch (request.format) {
      case 'csv': return { format: 'csv', records: csv(text, request.separator ?? ';', signal) };
      case 'camt053': return { format: 'camt053', records: xml(text, signal) };
      case 'ofx': case 'qfx': return { format: request.format, records: ofx(text, signal) };
      default: return fail('INVALID_FILE', 'Das Dateiformat wird nicht unterstützt.');
    }
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    // Bibliotheksfehler können Originalfinanztexte enthalten; nicht nach außen geben.
    return fail('INVALID_FILE', 'Die Datei ist syntaktisch ungültig.');
  }
}

function csv(text: string, separator: string, signal?: AbortSignal): SourceRecord[] {
  if (![',', ';', '\t'].includes(separator)) fail('INVALID_FILE', 'Das Trennzeichen wird nicht unterstützt.');
  const records: SourceRecord[] = [];
  let line = 1;
  let cursor = 0;
  Papa.parse<string[]>(text, {
    delimiter: separator, dynamicTyping: false, download: false, worker: false,
    skipEmptyLines: false,
    step(result, parser) {
      checkAbort(signal);
      // Ein abschließender Zeilenumbruch erzeugt keinen zusätzlichen Datensatz.
      if (cursor === text.length && result.data.length === 1 && result.data[0] === '') return;
      const sourceRow = records.length + 1;
      if (sourceRow > MAX_IMPORT_RECORDS) { parser.abort(); checkCount(sourceRow); }
      records.push({ sourceRow, line, cells: result.data, issues: result.errors.map(() => ({
        code: 'INVALID_RECORD', sourceRow, message: 'Die CSV-Zeile enthält ungültige Anführungszeichen oder Felder.'
      })) });
      line += (text.slice(cursor, result.meta.cursor).match(/\r\n|\r|\n/g) ?? []).length;
      cursor = result.meta.cursor;
    }
  });
  return records;
}

/** SAX-Ereignisse begrenzen Datensätze und Tiefe während des Parsens, ohne vollständigen Dokumentbaum. */
function xml(text: string, signal?: AbortSignal): SourceRecord[] {
  const parser = new SaxesParser({ xmlns: true });
  const records: SourceRecord[] = [];
  const stack: ImportNode[] = [];
  let depth = 0;
  let entryCount = 0;
  let detailCount = 0;
  let line = 1;
  parser.on('doctype', () => fail('INVALID_FILE', 'DTD und externe Entitäten sind nicht erlaubt.'));
  parser.on('error', () => fail('INVALID_FILE', 'Die XML-Datei ist syntaktisch ungültig.'));
  parser.on('opentag', tag => {
    checkAbort(signal);
    if (++depth > 128) fail('INVALID_FILE', 'Die XML-Verschachtelung ist zu tief.');
    if (tag.local === 'Ntry') { checkCount(++entryCount); line = parser.line + 1; }
    if (tag.local === 'TxDtls') checkCount(++detailCount);
    if (stack.length || tag.local === 'Ntry') {
      const node: ImportNode = { name: tag.local, namespace: tag.uri, attributes: {}, text: '', children: [] };
      for (const attribute of Object.values(tag.attributes)) node.attributes[attribute.name] = attribute.value;
      stack.at(-1)?.children.push(node);
      stack.push(node);
    }
  });
  const append = (textValue: string): void => { const node = stack.at(-1); if (node) node.text += textValue; };
  parser.on('text', append);
  parser.on('cdata', append);
  parser.on('closetag', () => {
    depth--;
    const node = stack.pop();
    if (node && !stack.length) records.push({ sourceRow: records.length + 1, line, node, issues: [] });
  });
  for (let offset = 0; offset < text.length; offset += 65_536) { checkAbort(signal); parser.write(text.slice(offset, offset + 65_536)); }
  parser.close();
  return records;
}

function ofx(text: string, signal?: AbortSignal): SourceRecord[] {
  // Lexikalischer Schutz vor dem etablierten SGML-Parser, keine eigene Syntaxkonvertierung.
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(text)) fail('INVALID_FILE', 'DTD und externe Entitäten sind nicht erlaubt.');
  if (/<(?:__proto__|constructor|prototype)(?=[\s/>])/i.test(text)) fail('INVALID_FILE', 'Reservierte OFX-Feldnamen sind nicht erlaubt.');
  let count = 0;
  for (const _match of text.matchAll(/<STMTTRN(?=[\s/>])/gi)) { checkAbort(signal); checkCount(++count); }
  checkAbort(signal);
  const parsed: unknown = parseSync(text);
  const records: SourceRecord[] = [];
  // Iterative Traversierung vermeidet zusätzliche rekursive Adapterstacks.
  const pending: unknown[] = [parsed];
  while (pending.length) {
    checkAbort(signal);
    const value = pending.pop();
    if (value === null || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value).reverse()) {
      if (key === 'STMTTRN') {
        for (const fields of Array.isArray(child) ? child : [child]) {
          checkCount(records.length + 1);
          if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) fail('INVALID_FILE', 'Ein OFX-Datensatz ist ungültig.');
          records.push({ sourceRow: records.length + 1, fields: fields as Record<string, unknown>, issues: [] });
        }
      } else if (Array.isArray(child)) { for (const item of (child as unknown[]).toReversed()) pending.push(item); }
      else pending.push(child);
    }
  }
  if (!text.includes('<OFX>') || !records.length) fail('INVALID_FILE', 'Die Datei enthält keine OFX-Buchungen.');
  return records;
}
