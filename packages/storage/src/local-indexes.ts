// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';
import type { TransactionAggregate } from '@wimm/domain';
import type { ImportFingerprintAggregate } from '@wimm/domain';
import type { StoredAggregate, PendingOperation } from './contracts.js';

export interface TransactionIndexRow { profileId: UUID; spaceId: UUID; handle: UUID; kind: 'account'|'category'|'import'; reference: string; date: string }
export interface ImportSourceIndexRow {profileId:UUID;spaceId:UUID;handle:UUID;accountId:UUID;parserSource:string;externalId:string;transactionId:UUID}
export function importSourceIndexRows(profileId:UUID,aggregate:StoredAggregate):ImportSourceIndexRow[]{
 if(aggregate.aggregateType!=='importFingerprint'||aggregate.deletedAt!==undefined)return [];
 const source=aggregate as StoredAggregate & ImportFingerprintAggregate;
 return source.externalId===undefined?[]:[{profileId,spaceId:source.spaceId,handle:source.handle,accountId:source.accountId,parserSource:source.parserSource,externalId:source.externalId,transactionId:source.transactionId}];
}
/** Sekundärreferenzen sind abgeleitete Speicheradressen; keinerlei Geldberechnung. */
export function transactionIndexRows(profileId: UUID, aggregate: StoredAggregate): TransactionIndexRow[] {
  if (aggregate.aggregateType !== 'transaction' || aggregate.deletedAt !== undefined) return [];
  const transaction = aggregate as StoredAggregate & TransactionAggregate;
  const references: readonly ['account'|'category'|'import',string][] = [ ['account',transaction.accountId], ...[...new Set(transaction.splits.map(split=>split.categoryId))].map(id=>['category',id] as ['category',string]), ...(transaction.importReference === undefined ? [] : [['import',transaction.importReference] as ['import',string]]) ];
  return references.map(([kind,reference])=>({profileId,spaceId:aggregate.spaceId,handle:aggregate.handle,kind,reference,date:transaction.date}));
}
export function pendingCreatedAt(operation: PendingOperation): string {
  if (operation.createdAt !== undefined) return operation.createdAt;
  if (typeof operation.draft === 'object' && operation.draft !== null && 'occurredAt' in operation.draft && typeof operation.draft.occurredAt === 'string') return operation.draft.occurredAt;
  return '';
}
