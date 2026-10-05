// SPDX-License-Identifier: AGPL-3.0-or-later
import { handleWorkerRequest } from './worker.js';
import type { ParseRequest } from './types.js';
// Dedicated Worker, ein Auftrag je Instanz; Abbruch durch terminate statt wartender Nachricht.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage(value: unknown): void;
};
scope.onmessage = event => {
  scope.postMessage({ started: true });
  scope.postMessage(handleWorkerRequest(event.data));
};
