// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseImport } from './parser.js';
import { ImportFailure } from './types.js';
import type { ImportIssue, ParseRequest, ParseResult } from './types.js';

export type WorkerMessage = { started: true } | WorkerReply;
export type WorkerReply = { ok: true; result: ParseResult } | { ok: false; issue: ImportIssue };
export function handleWorkerRequest(request: ParseRequest): WorkerReply {
  try { return { ok: true, result: parseImport(request) }; }
  catch (error) {
    return { ok: false, issue: error instanceof ImportFailure ? error.issue : { code: 'INVALID_FILE', message: 'Die Importdatei ist ungültig.' } };
  }
}
