// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImportFailure, MAX_IMPORT_OUTPUT_BYTES } from './types.js';

/** Structured Clone erhält gemeinsame Objektverweise: Quellbäume nur einmal zählen. */
export function createImportOutputBudget() {
  const seen = new WeakSet<object>(); let bytes = 0;
  const encoder = new TextEncoder();
  const scratch = new Uint8Array(1024);
  function utf8Length(text: string): number {
    const encoded = encoder.encodeInto(text, scratch);
    // Nur vollständig codierte Texte übernehmen; lange oder mehrbyteige Texte behalten exakt den bisherigen Pfad.
    return encoded.read === text.length ? encoded.written : encoder.encode(text).byteLength;
  }
  function count(size: number) {
    bytes += size;
    if (bytes > MAX_IMPORT_OUTPUT_BYTES) throw new ImportFailure({ code: 'FILE_LIMIT', message: 'Die Importausgabe überschreitet das Ressourcenlimit.' });
  }
  return (value: unknown): void => {
    const pending: unknown[] = [value];
    while (pending.length) {
      const entry = pending.pop();
      if (typeof entry === 'string') { count(utf8Length(entry) + 8); continue; }
      if (entry === null || typeof entry !== 'object') { count(8); continue; }
      if (seen.has(entry)) continue;
      seen.add(entry); count(32);
      if (Array.isArray(entry)) { count(entry.length * 8); for (const child of entry as unknown[]) pending.push(child); }
      else for (const [key, child] of Object.entries(entry)) { count(utf8Length(key) + 8); pending.push(child); }
    }
  };
}
