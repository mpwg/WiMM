// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';
import { financialAggregateSchema, consumptionPayloadSchema, importCandidateSchema } from './financial-aggregates.js';
import { uuidSchema, revisionSchema, utcTimestampSchema, isoDateSchema, moneySchema, safeIntegerSchema } from './primitives.js';

/** Bindingversion, Fachversion und lokale Storageversion sind unabhängige Verträge. */
export const FINANCE_ENGINE_CONTRACT_VERSION = 1 as const;
export const financeCommandTypes = ['account.save', 'account.archive', 'categoryGroup.save', 'category.save', 'category.archive', 'payee.save', 'payee.merge', 'transaction.save', 'transaction.delete', 'transfer.save', 'transfer.delete', 'reconciliation.confirm', 'reconciliation.unlock', 'importMapping.save', 'importBatch.save', 'import.commit', 'rule.save', 'rule.delete', 'rule.reorder', 'schedule.save', 'schedule.confirm', 'schedule.skip'] as const;
export const financeErrorCodes = ['INVALID_DATE', 'INVALID_MONTH', 'INVALID_MONEY', 'INVALID_SAFE_INTEGER', 'MONEY_OVERFLOW', 'INVALID_DIVISOR', 'INVALID_COMMAND', 'INVALID_AGGREGATE', 'DUPLICATE_REFERENCE', 'REVISION_MISSING', 'REVISION_CONFLICT', 'REVISION_OVERFLOW', 'CROSS_SPACE_REFERENCE', 'INVALID_GENERATOR'] as const;
export type FinanceErrorCode = typeof financeErrorCodes[number];
export const coreAggregateSchema = financialAggregateSchema.refine((aggregate) => !Object.hasOwn(aggregate, 'handle'), 'Lokale Speicherhandles gehören nicht in Fachaggregate des Bindings.');
export const coreRevisionExpectationSchema = z.object({ id: uuidSchema, expectedRevision: revisionSchema }).strict();
const aggregateList = z.array(coreAggregateSchema);
const resultMetadata = { contractVersion: z.literal(FINANCE_ENGINE_CONTRACT_VERSION) };
const metadata = { contractVersion: z.literal(FINANCE_ENGINE_CONTRACT_VERSION), domainSchemaVersion: z.literal(1), spaceId: uuidSchema };
export const coreStateRequestSchema = z.object({ ...metadata, aggregates: aggregateList }).strict();

const saves = ['account.save', 'categoryGroup.save', 'category.save', 'payee.save', 'transaction.save', 'transfer.save', 'importMapping.save', 'importBatch.save', 'rule.save', 'schedule.save'] as const;
export const coreCommandSchema = z.discriminatedUnion('commandType', [
  z.object({ commandType: z.enum(saves), aggregates: aggregateList.min(1) }).strict(),
  z.object({ commandType: z.enum(['account.archive', 'category.archive', 'transaction.delete', 'transfer.delete', 'rule.delete']), aggregateId: uuidSchema }).strict(),
  z.object({ commandType: z.literal('payee.merge'), targetId: uuidSchema, sourceIds: z.array(uuidSchema).min(1), transactionIds: z.array(uuidSchema) }).strict(),
  z.object({ commandType: z.literal('reconciliation.confirm'), accountId: uuidSchema, statementDate: isoDateSchema, statementBalance: moneySchema, selectedTransactionIds: z.array(uuidSchema).min(1) }).strict(),
  z.object({ commandType: z.literal('reconciliation.unlock'), reconciliationId: uuidSchema }).strict(),
  z.object({ commandType: z.literal('import.commit'), importId: uuidSchema }).strict(),
  z.object({ commandType: z.literal('rule.reorder'), ruleIds: z.array(uuidSchema) }).strict(),
  z.object({ commandType: z.literal('schedule.confirm'), scheduleId: uuidSchema, dueDate: isoDateSchema, importedTransactionId: uuidSchema.optional() }).strict(),
  z.object({ commandType: z.literal('schedule.skip'), scheduleId: uuidSchema, dueDate: isoDateSchema }).strict()
]);
export const coreCommandRequestSchema = z.object({ ...metadata, aggregates: aggregateList, command: coreCommandSchema,
  expectedRevisions: z.array(coreRevisionExpectationSchema), context: z.object({ operationId: uuidSchema, occurredAt: utcTimestampSchema, generatedIds: z.array(uuidSchema) }).strict()
}).strict();
const coreError = z.object({ code: z.enum([...financeErrorCodes, 'UPDATE_REQUIRED']), message: z.string().min(1) }).strict();
export const coreFinancialProjectionsSchema = z.object({ accountBalances: z.array(z.object({ accountId: uuidSchema, balance: moneySchema }).strict()), consumption: consumptionPayloadSchema }).strict();
export const coreChangeSetSchema = z.object({ spaceId: uuidSchema, operationId: uuidSchema, occurredAt: utcTimestampSchema, commandType: z.enum(financeCommandTypes), expectedRevisions: z.array(coreRevisionExpectationSchema), aggregates: aggregateList }).strict();
export const coreCommandResultSchema = z.discriminatedUnion('status', [
  z.object({ ...resultMetadata, status: z.literal('changed'), changeSet: coreChangeSetSchema }).strict(),
  z.object({ ...resultMetadata, status: z.literal('unchanged') }).strict(),
  z.object({ ...resultMetadata, status: z.literal('rejected'), error: coreError }).strict()
]);
export const coreProjectionResultSchema = z.discriminatedUnion('status', [z.object({ ...resultMetadata, status: z.literal('projected'), projections: coreFinancialProjectionsSchema }).strict(), z.object({ ...resultMetadata, status: z.literal('rejected'), error: coreError }).strict()]);
export const coreValidationRequestSchema = z.discriminatedUnion('mode', [
  z.object({ ...metadata, mode: z.literal('historical'), aggregates: aggregateList }).strict(),
  z.object({ ...metadata, mode: z.literal('mutation'), before: aggregateList, after: aggregateList }).strict()
]);
export const coreValidationResultSchema = z.discriminatedUnion('status', [z.object({ ...resultMetadata, status: z.literal('valid') }).strict(), z.object({ ...resultMetadata, status: z.literal('rejected'), error: coreError }).strict()]);
export const coreInverseRequestSchema = z.object({ ...metadata, aggregates: aggregateList, expectedRevisions: z.array(coreRevisionExpectationSchema),
  targets: z.array(z.object({ id: uuidSchema, previous: coreAggregateSchema.optional() }).strict()).min(1),
  context: z.object({ operationId: uuidSchema, occurredAt: utcTimestampSchema, generatedIds: z.array(uuidSchema) }).strict()
}).strict();
export const coreCalculationRequestSchema = z.discriminatedUnion('calculationType', [
  z.object({ ...metadata, calculationType: z.literal('money.parse'), text: z.string() }).strict(),
  z.object({ ...metadata, calculationType: z.literal('rule.apply'), aggregates: aggregateList, candidate: importCandidateSchema }).strict(),
  z.object({ ...metadata, calculationType: z.literal('schedule.dueDates'), aggregates: aggregateList, scheduleId: uuidSchema, through: isoDateSchema }).strict(),
  z.object({ ...metadata, calculationType: z.literal('import.classify'), aggregates: aggregateList, accountId: uuidSchema, candidates: z.array(importCandidateSchema) }).strict()
]);
export const coreCalculationResultSchema = z.discriminatedUnion('status', [
  z.object({ ...resultMetadata, status: z.literal('money'), value: moneySchema }).strict(),
  z.object({ ...resultMetadata, status: z.literal('ruleApplied'), candidate: importCandidateSchema, appliedRuleIds: z.array(uuidSchema) }).strict(),
  z.object({ ...resultMetadata, status: z.literal('dueDates'), dates: z.array(isoDateSchema) }).strict(),
  z.object({ ...resultMetadata, status: z.literal('classified'), rows: z.array(z.object({ sourceRow: safeIntegerSchema.positive(), classification: z.enum(['new', 'duplicate', 'conflict']) }).strict()) }).strict(),
  z.object({ ...resultMetadata, status: z.literal('rejected'), error: coreError }).strict()
]);
export type CoreInverseRequest = z.infer<typeof coreInverseRequestSchema>;
export type CoreCalculationRequest = z.infer<typeof coreCalculationRequestSchema>;
export type CoreCalculationResult = z.infer<typeof coreCalculationResultSchema>;
export type CoreCommandRequest = z.infer<typeof coreCommandRequestSchema>;
export type CoreCommandResult = z.infer<typeof coreCommandResultSchema>;
export type CoreStateRequest = z.infer<typeof coreStateRequestSchema>;
export type CoreProjectionResult = z.infer<typeof coreProjectionResultSchema>;
export type CoreValidationRequest = z.infer<typeof coreValidationRequestSchema>;
export type CoreValidationResult = z.infer<typeof coreValidationResultSchema>;

/** Gleicher logischer Port für WASM und direkte/native Bindings; keine Persistenz im Kern. */
export interface FinanceEnginePort {
  execute(request: CoreCommandRequest): Promise<CoreCommandResult>;
  reverse(request: CoreInverseRequest): Promise<CoreCommandResult>;
  calculate(request: CoreCalculationRequest): Promise<CoreCalculationResult>;
  project(request: CoreStateRequest): Promise<CoreProjectionResult>;
  validate(request: CoreValidationRequest): Promise<CoreValidationResult>;
}

export const storageVersionsSchema = z.object({ storageSchemaVersion: safeIntegerSchema.positive(), domainSchemaVersion: safeIntegerSchema.positive() }).strict();
export const storageMigrationStepSchema = z.object({ number: safeIntegerSchema.positive(), from: storageVersionsSchema, to: storageVersionsSchema, destructive: z.boolean() }).strict().refine((step) => step.to.storageSchemaVersion >= step.from.storageSchemaVersion && step.to.domainSchemaVersion >= step.from.domainSchemaVersion && (step.to.storageSchemaVersion > step.from.storageSchemaVersion || step.to.domainSchemaVersion > step.from.domainSchemaVersion), 'Migrationen sind ausschließlich vorwärtsgerichtet.');
export const storageMigrationPlanSchema = z.object({ expectedMigrationNumber: safeIntegerSchema.nonnegative(), from: storageVersionsSchema, steps: z.array(storageMigrationStepSchema).min(1) }).strict().superRefine((plan, context) => {
  let previous = plan.from;
  for (const [index, step] of plan.steps.entries()) {
    if (step.number !== plan.expectedMigrationNumber + index + 1 || step.from.storageSchemaVersion !== previous.storageSchemaVersion || step.from.domainSchemaVersion !== previous.domainSchemaVersion) context.addIssue({ code: 'custom', path: ['steps', index], message: 'Migrationsnummern und Ausgangsversionen müssen lückenlos anschließen.' });
    previous = step.to;
  }
});
export type StorageMigrationPlan = z.infer<typeof storageMigrationPlanSchema>;
