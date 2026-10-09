// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';
import { isoDateSchema, moneySchema, positiveRevisionSchema, revisionSchema, safeIntegerSchema, utcTimestampSchema, uuidSchema } from './primitives.js';

export const financialAggregateTypes = ['account', 'financialRevision', 'categoryGroup', 'category', 'payee', 'transaction', 'transfer', 'reconciliation', 'importMapping', 'importBatch', 'importFingerprint', 'rule', 'schedule', 'scheduleOccurrence'] as const;
const text = z.string().refine((value) => value.trim().length > 0);
const ordinal = safeIntegerSchema.nonnegative();
const positiveOrdinal = safeIntegerSchema.positive();
const metadata = { handle: uuidSchema.optional(), id: uuidSchema, spaceId: uuidSchema, revision: positiveRevisionSchema, createdAt: utcTimestampSchema, updatedAt: utcTimestampSchema, deletedAt: utcTimestampSchema.optional() };
const split = z.object({ id: uuidSchema, categoryId: uuidSchema, amount: moneySchema }).strict();
const transactionFields = {
  accountId: uuidSchema, date: isoDateSchema, amount: moneySchema, kind: z.enum(['normal', 'opening', 'transfer', 'contribution', 'settlement']),
  payeeId: uuidSchema.optional(), note: z.string().optional(), clearance: z.enum(['uncleared', 'cleared', 'reconciled']),
  importReference: text.optional(), scheduleOccurrenceId: uuidSchema.optional(), transferId: uuidSchema.optional(), splits: z.array(split)
};
export const importCandidateSchema = z.object({ sourceRow: positiveOrdinal, parserSource: z.enum(['csv', 'camt053', 'ofx', 'qfx']).optional(), date: isoDateSchema, amount: moneySchema,
  payee: z.string().optional(), memo: z.string().optional(), externalId: z.string().optional(), sourceFingerprint: text.optional(), categoryId: uuidSchema.optional(), payeeId: uuidSchema.optional(), clearance: z.enum(['uncleared', 'cleared']).optional() }).strict();

/** Formvertragsprüfung; berechnete Fachinvarianten verbleiben ausschließlich im Fachkern. */
export const financialAggregateSchema = z.discriminatedUnion('aggregateType', [
  z.object({ ...metadata, aggregateType: z.literal('account'), name: text, type: z.enum(['checking', 'cash', 'savings', 'credit', 'other']), onBudget: z.boolean(), archived: z.boolean() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('financialRevision') }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('categoryGroup'), name: text, kind: z.enum(['income', 'expense']), sortOrder: ordinal, archived: z.boolean() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('category'), name: text, groupId: uuidSchema, sortOrder: ordinal, archived: z.boolean(), system: z.literal('uncategorized').optional() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('payee'), name: text, aliases: z.array(text), archived: z.boolean() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('transaction'), ...transactionFields }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('transfer'), date: isoDateSchema, sourceAccountId: uuidSchema, targetAccountId: uuidSchema, sourceTransactionId: uuidSchema, targetTransactionId: uuidSchema, amount: moneySchema, budgetCategoryId: uuidSchema.optional(), budgetRelease: z.boolean().optional() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('reconciliation'), accountId: uuidSchema, statementDate: isoDateSchema, statementBalance: moneySchema, transactionIds: z.array(uuidSchema).min(1) }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('importMapping'), name: text, mapping: z.json() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('importBatch'), fileHash: z.string().regex(/^[a-f0-9]{64}$/), accountId: uuidSchema,
    rows: z.array(z.object({ sourceRow: positiveOrdinal, candidate: importCandidateSchema.nullable(), decision: z.enum(['import', 'exclude', 'separate']), issues: z.array(z.string()) }).strict()).min(1).max(100_000), committedRows: z.array(positiveOrdinal), state: z.enum(['ready', 'partial', 'completed']) }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('importFingerprint'), accountId: uuidSchema, parserSource: text, externalId: z.string().optional(), fingerprint: text, transactionId: uuidSchema, importId: uuidSchema, sourceRow: positiveOrdinal }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('rule'), order: ordinal, conditions: z.array(z.object({ field: z.enum(['date', 'amount', 'payee', 'memo']), operator: z.enum(['equals', 'contains', 'gte', 'lte']), value: z.union([z.string(), moneySchema]) }).strict()).min(1), actions: z.array(z.union([
    z.object({ field: z.enum(['categoryId', 'payeeId']), value: uuidSchema }).strict(), z.object({ field: z.literal('clearance'), value: z.enum(['uncleared', 'cleared']) }).strict()
  ])).min(1), stopProcessing: z.boolean(), enabled: z.boolean() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('schedule'), startDate: isoDateSchema, frequency: z.enum(['weekly', 'monthly', 'yearly']), interval: positiveOrdinal, endDate: isoDateSchema.optional(), enabled: z.boolean(),
    template: z.object(transactionFields).omit({ date: true, scheduleOccurrenceId: true, importReference: true }).strict() }).strict(),
  z.object({ ...metadata, aggregateType: z.literal('scheduleOccurrence'), scheduleId: uuidSchema, dueDate: isoDateSchema, state: z.enum(['confirmed', 'skipped']), transactionId: uuidSchema.optional() }).strict()
]);

export const storedFinancialAggregateSchema = financialAggregateSchema.and(z.object({ handle: uuidSchema }));
export const accountBalancePayloadSchema = z.object({ accountId: uuidSchema.optional(), balance: moneySchema }).strict();
export const consumptionPayloadSchema = z.object({ income: moneySchema, expense: moneySchema, net: moneySchema, categories: z.array(z.object({ categoryId: uuidSchema, groupKind: z.enum(['income', 'expense']), amount: moneySchema }).strict()) }).strict();
const projection = z.discriminatedUnion('kind', [
  z.object({ spaceId: uuidSchema, kind: z.literal('balance'), key: uuidSchema, payload: moneySchema }).strict(),
  z.object({ spaceId: uuidSchema, kind: z.literal('accountBalance'), key: uuidSchema, payload: accountBalancePayloadSchema }).strict(),
  z.object({ spaceId: uuidSchema, kind: z.literal('consumption'), key: text, payload: consumptionPayloadSchema }).strict()
]);
const syncState = z.object({ profileId: uuidSchema, spaceId: uuidSchema, epoch: uuidSchema, cursor: z.string().regex(/^(0|[1-9]\d*)$/) }).strict();
const pending = z.object({ operationId: uuidSchema, spaceId: uuidSchema, expectedRevisions: z.array(z.object({ handle: uuidSchema, expectedRevision: revisionSchema }).strict()), dependsOn: z.array(uuidSchema), state: z.enum(['queued', 'sending', 'accepted', 'conflict', 'blocked', 'forbidden', 'invalid']), draft: z.json(), retryCount: ordinal, createdAt: utcTimestampSchema.optional() }).strict();
export const localSnapshotSchema = z.object({ storageSchemaVersion: z.union([z.literal(1),z.literal(2)]), domainSchemaVersion: z.literal(1), profileId: uuidSchema, spaceId: uuidSchema, epoch: uuidSchema,
  aggregates: z.array(storedFinancialAggregateSchema), confirmed: z.array(z.object({ spaceId: uuidSchema, epoch: uuidSchema, aggregate: storedFinancialAggregateSchema }).strict()), pending: z.array(pending), projections: z.array(projection), syncState: syncState.optional() }).strict();
