// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImportFailure, MAX_IMPORT_OUTPUT_BYTES } from './types.js';

/** Structured Clone erhält gemeinsame Objektverweise: Quellbäume nur einmal zählen. */
export function createImportOutputBudget() {
  const seen = new WeakSet<object>(); let bytes = 0;
  const encoder = new TextEncoder();
  function count(size: number) {
    bytes += size;
    if (bytes > MAX_IMPORT_OUTPUT_BYTES) throw new ImportFailure({ code: 'FILE_LIMIT', message: 'Die Importausgabe überschreitet das Ressourcenlimit.' });
  }
  return (value: unknown): void => {
    const pending: unknown[] = [value];
    while (pending.length) {
      const entry = pending.pop();
      if (typeof entry === 'string') { count(encoder.encode(entry).byteLength + 8); continue; }
      if (entry === null || typeof entry !== 'object') { count(8); continue; }
      if (seen.has(entry)) continue;
      seen.add(entry); count(32);
      if (Array.isArray(entry)) { count(entry.length * 8); for (const child of entry as unknown[]) pending.push(child); }
      else for (const [key, child] of Object.entries(entry)) { count(encoder.encode(key).byteLength + 8); pending.push(child); }
    }
  };
}
