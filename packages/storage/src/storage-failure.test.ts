// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { decodeStorageFailure, normalizeStorageWriteFailure } from './storage-failure.js';
it('bewahrt alle stabilen Codes ohne fremde Meldungen oder Nutzdaten', () => {
  for (const code of ['REVISION_CONFLICT','QUOTA','RESOURCE_UNAVAILABLE','WRITE_FAILED','UPDATE_REQUIRED','EPOCH_MISMATCH','CANCELLED','COMMIT_UNKNOWN','INVALID_RESPONSE','OPERATION_ID_REUSED']) {
    const failure = decodeStorageFailure({ contractVersion: 2, code, commitState: code === 'COMMIT_UNKNOWN' ? 'unknown' : 'notCommitted' });
    expect(failure.code).toBe(code); expect(failure.message).not.toContain('secret');
  }
});
it('weist manipulierte, unbekannte und textuelle Antworten konservativ ab', () => {
  for (const input of [null, 'Die lokale Revision ist nicht mehr aktuell.', {contractVersion:2,code:'SECRET-secret',commitState:'notCommitted'}, {contractVersion:1,code:'QUOTA',commitState:'notCommitted'}, {contractVersion:2,code:'QUOTA',commitState:'notCommitted',payload:'secret'}, {contractVersion:2,code:'COMMIT_UNKNOWN',commitState:'notCommitted'}, Object.create({contractVersion:2,code:'QUOTA',commitState:'notCommitted'})]) {
    const failure = decodeStorageFailure(input); expect(failure.code).toBe('INVALID_RESPONSE'); expect(failure.commitState).toBe('unknown'); expect(JSON.stringify(failure)).not.toContain('secret');
  }
});
it('klassifiziert Plattformfehler nach Typ ohne deren Text zu übernehmen', () => {
  for (const [name, code] of [['QuotaExceededError','QUOTA'],['AbortError','CANCELLED'],['InvalidStateError','RESOURCE_UNAVAILABLE']]) expect(normalizeStorageWriteFailure(new DOMException('secret',name)).code).toBe(code);
  expect(normalizeStorageWriteFailure(new Error('secret stale revision')).commitState).toBe('unknown');
});
