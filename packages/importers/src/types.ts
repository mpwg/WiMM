// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IsoDate, Money } from '@wimm/contracts';

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 100_000;
export type ImportFormat = 'csv' | 'camt053' | 'ofx' | 'qfx';
export type ImportErrorCode = 'FILE_LIMIT' | 'RECORD_LIMIT' | 'ABORTED' | 'INVALID_FILE' | 'INVALID_RECORD' | 'UNSUPPORTED_CURRENCY' | 'WORKER_ERROR';
export interface ImportIssue {
  code: ImportErrorCode;
  message: string;
  sourceRow?: number;
  field?: string;
}
export class ImportFailure extends Error {
  constructor(readonly issue: ImportIssue) { super(issue.message); this.name = 'ImportFailure'; }
}
export interface ImportNode {
  name: string;
  namespace: string;
  attributes: Record<string, string>;
  text: string;
  children: ImportNode[];
}
export interface SourceRecord {
  /** Stabile 1-basierte Datensatznummer; bei CSV zählt eine Kopfzeile mit. */
  sourceRow: number;
  line?: number;
  cells?: string[];
  node?: ImportNode;
  fields?: Record<string, unknown>;
  issues: ImportIssue[];
}
export interface ParseRequest {
  bytes: Uint8Array;
  format: ImportFormat;
  encoding?: 'utf-8' | 'windows-1252';
  separator?: ',' | ';' | '\t';
}
export interface ParseResult { format: ImportFormat; records: SourceRecord[] }
export interface CanonicalImportRecord {
  sourceRow: number;
  date: string;
  /** Bereits explizit gemappter Dezimaltext, ohne Tausendertrennzeichen. */
  amount: string;
  currency: string;
  payee?: string;
  memo?: string;
  externalId?: string;
}
export interface NormalizedImportRecord extends Omit<CanonicalImportRecord, 'date' | 'amount' | 'currency'> {
  date: IsoDate;
  amount: Money;
  currency: 'EUR';
}
export type NormalizationResult = { record: NormalizedImportRecord; issues: [] } | { record: null; issues: ImportIssue[] };
