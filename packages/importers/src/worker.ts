// SPDX-License-Identifier: AGPL-3.0-or-later
import { createImportPreview } from './preview.js';
import { parseImport } from './parser.js';
import { ImportFailure } from './types.js';
import type { ImportIssue, ParseRequest, ParseResult } from './types.js';

export type WorkerMessage = { started: true } | WorkerReply;
export type WorkerReply = { ok: true; result: ParseResult } | { ok: false; issue: ImportIssue };
export function handleWorkerRequest(request: ParseRequest): WorkerReply {
  try { const parsed = parseImport(request); return { ok: true, result: request.preview ? { ...parsed, preview: createImportPreview(parsed, request.mapping) } : parsed }; }
  catch (error) {
    return { ok: false, issue: error instanceof ImportFailure ? error.issue : { code: 'INVALID_FILE', message: 'Die Importdatei ist ungültig.' } };
  }
}
