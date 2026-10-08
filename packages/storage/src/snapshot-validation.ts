// SPDX-License-Identifier: AGPL-3.0-or-later
import { financialAggregateSchema, localSnapshotSchema } from '@wimm/contracts';
import type { UUID } from '@wimm/contracts';
import { validateFinancialProjectionCache, validateFinancialState, type P2Aggregate } from '@wimm/domain';
import { StorageWriteError, type LocalSnapshot, type StoredAggregate } from './contracts.js';

function invalid(): never { throw new StorageWriteError('Der Snapshot ist nicht unterstützt, vollständig oder konsistent. Der vorhandene Stand bleibt erhalten.'); }
function unique(values: readonly string[]): void { if (new Set(values).size !== values.length) invalid(); }

/** Keine Mutation oder Reparatur: Form, Kontext, Fachbestand und Caches vor Ersatz prüfen. */
export function validateLocalSnapshot(value: unknown, profileId: UUID): LocalSnapshot {
  const parsed = localSnapshotSchema.safeParse(value);
  if (!parsed.success) invalid();
  const snapshot = structuredClone(parsed.data) as unknown as LocalSnapshot;
  if (snapshot.profileId !== profileId) invalid();
  const { spaceId, epoch } = snapshot;
  const aggregate = (entry: StoredAggregate) => { if (entry.spaceId !== spaceId || entry.handle !== entry.id) invalid(); };
  snapshot.aggregates.forEach(aggregate);
  unique(snapshot.aggregates.map((entry) => entry.handle));
  unique(snapshot.confirmed.map((entry) => entry.aggregate.handle));
  const local = new Map(snapshot.aggregates.map((entry) => [entry.id, entry]));
  const confirmed = new Map<UUID, P2Aggregate>(local);
  for (const entry of snapshot.confirmed) {
    aggregate(entry.aggregate);
    if (entry.spaceId !== spaceId || entry.epoch !== epoch || entry.aggregate.aggregateType === 'financialRevision' || (local.has(entry.aggregate.id) && local.get(entry.aggregate.id)?.aggregateType !== entry.aggregate.aggregateType)) invalid();
    confirmed.set(entry.aggregate.id, entry.aggregate);
  }
  unique(snapshot.pending.map((entry) => entry.operationId));
  for (const operation of snapshot.pending) {
    if (operation.spaceId !== spaceId) invalid();
    unique(operation.expectedRevisions.map((entry) => entry.handle)); unique(operation.dependsOn);
    if (typeof operation.draft === 'object' && operation.draft !== null && 'spaceId' in operation.draft && operation.draft.spaceId !== spaceId) invalid();
    if (typeof operation.draft === 'object' && operation.draft !== null && 'aggregates' in operation.draft) {
      const draft = operation.draft.aggregates;
      if (!Array.isArray(draft) || draft.some((entry: unknown) => !financialAggregateSchema.safeParse(entry).success || typeof entry !== 'object' || entry === null || !('spaceId' in entry) || entry.spaceId !== spaceId)) invalid();
    }
  }
  unique(snapshot.projections.map((entry) => JSON.stringify([entry.kind, entry.key])));
  if (snapshot.projections.some((entry) => entry.spaceId !== spaceId)) invalid();
  if (snapshot.syncState !== undefined && (snapshot.syncState.profileId !== profileId || snapshot.syncState.spaceId !== spaceId || snapshot.syncState.epoch !== epoch)) invalid();
  try {
    validateFinancialState(snapshot.aggregates, spaceId);
    if (snapshot.confirmed.length > 0) validateFinancialState([...confirmed.values()], spaceId);
    const source = snapshot.aggregates.some((entry) => entry.aggregateType !== 'financialRevision') ? snapshot.aggregates : [...confirmed.values()];
    validateFinancialProjectionCache(source, snapshot.projections);
  } catch { invalid(); }
  return snapshot;
}
