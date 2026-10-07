// SPDX-License-Identifier: AGPL-3.0-or-later
import { createImportOutputBudget } from './output-budget.js';
import { createImportPreview } from './preview.js';
import { parseImport } from './parser.js';
import { ImportFailure } from './types.js';
import type { ImportIssue, ParseRequest, ParseResult } from './types.js';

export type WorkerMessage = { started: true } | WorkerReply;
export type WorkerReply = { ok: true; result: ParseResult } | { ok: false; issue: ImportIssue };
export function handleWorkerRequest(request: ParseRequest): WorkerReply {
  try { const parsed = parseImport(request); const result = request.preview ? { ...parsed, preview: createImportPreview(parsed, request.mapping) } : parsed; createImportOutputBudget()(result); return { ok: true, result }; }
  catch (error) {
    return { ok: false, issue: error instanceof ImportFailure ? error.issue : { code: 'INVALID_FILE', message: 'Die Importdatei ist ungültig.' } };
  }
}
