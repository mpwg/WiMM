// SPDX-License-Identifier: AGPL-3.0-or-later
import { commitImportGroup, type ImportBatchAggregate, type P2Aggregate } from '@wimm/domain';
self.onmessage = (event: MessageEvent<{ batch: ImportBatchAggregate; all: P2Aggregate[]; occurredAt: string }>) => {
  try { self.postMessage({ change: commitImportGroup(event.data.batch, event.data.all, { ids: { next: () => crypto.randomUUID() }, clock: { now: () => event.data.occurredAt } }) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Die Importgruppe ist ungültig.' }); }
};
