// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  positiveRevisionSchema,
  revisionSchema,
  utcTimestampSchema,
  uuidSchema
} from '@wimm/contracts';
import type { Revision, UtcTimestamp, UUID } from '@wimm/contracts';

import { DomainValidationError } from './errors.js';
import type { AccountAggregate } from './master-data.js';
import { validateFinancialMutation } from './financial-validation.js';

export const p2AggregateTypes = [
  'account',
  'financialRevision',
  'categoryGroup',
  'category',
  'payee',
  'transaction',
  'transfer',
  'reconciliation', 'importMapping', 'importBatch', 'importFingerprint', 'rule', 'schedule', 'scheduleOccurrence'
] as const;

export type P2AggregateType = (typeof p2AggregateTypes)[number];

export const p2CommandTypes = [
  'account.save',
  'account.archive',
  'categoryGroup.save',
  'category.save',
  'category.archive',
  'payee.save',
  'payee.merge',
  'transaction.save',
  'transaction.delete',
  'transfer.save',
  'transfer.delete',
  'reconciliation.confirm',
  'reconciliation.unlock', 'importMapping.save', 'importBatch.save', 'import.commit', 'rule.save', 'rule.delete', 'rule.reorder', 'schedule.save', 'schedule.confirm', 'schedule.skip'
] as const;

export type P2CommandType = (typeof p2CommandTypes)[number];

/** Gemeinsame Metadaten jedes entschlüsselten Finanzaggregats. */
export interface AggregateMetadata {
  readonly id: UUID;
  readonly spaceId: UUID;
  readonly revision: Revision;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly deletedAt?: UtcTimestamp;
}

/**
 * Ein vollständiges Fachaggregat. Die jeweiligen Fachfelder ergänzt die
 * Teilaufgabe seines Befehlshandlers als `TFields`; Teilupdates sind nicht
 * darstellbar.
 */
export type P2Aggregate<
  TType extends P2AggregateType = P2AggregateType,
  TFields extends object = object
> = AggregateMetadata &
  TFields & {
    readonly aggregateType: TType;
  };

/** Ausschließlich lokale CAS-Revision des vollständigen Finanzbestands; keine Geldprojektion. */
export type FinancialRevisionAggregate = P2Aggregate<'financialRevision'>;

/** Öffentlicher Kopfstand genügt der Revisionsprüfung, nicht jedoch einer Finanzberechnung. */
export interface AggregateHead {
  readonly id: UUID;
  readonly spaceId: UUID;
  readonly revision: Revision;
  readonly aggregateType: P2AggregateType;
}

/** Der Fachkern erhält den Kopfstand als Port und kennt keine Speicherimplementierung. */
export interface AggregateHeadReader {
  get(id: UUID): AggregateHead | undefined;
  list?(spaceId: UUID): readonly P2Aggregate[];
}

export interface RevisionExpectation {
  readonly id: UUID;
  readonly expectedRevision: Revision;
}

export interface AggregateMutation<TAggregate extends P2Aggregate = P2Aggregate> {
  readonly aggregate: TAggregate;
}

/** Eine vollständige, clientinterne Befehlseingabe ohne Transporthülle. */
export interface FullCommandInput<
  TCommandType extends P2CommandType = P2CommandType,
  TAggregate extends P2Aggregate = P2Aggregate
> {
  readonly commandType: TCommandType;
  readonly spaceId: UUID;
  readonly expectedRevisions: readonly RevisionExpectation[];
  readonly mutations: readonly AggregateMutation<TAggregate>[];
}

/** ID und Zeit werden ausschließlich durch die Client-Komposition injiziert. */
export interface DomainDependencies {
  readonly ids: {
    next(): UUID;
  };
  readonly clock: {
    now(): UtcTimestamp;
  };
}

export interface CommandStamp {
  readonly operationId: UUID;
  readonly occurredAt: UtcTimestamp;
}

/** Die reine Änderungsmenge wird später gemeinsam mit Outbox und Projektionen gespeichert. */
export interface DomainChangeSet<
  TCommandType extends P2CommandType = P2CommandType,
  TAggregate extends P2Aggregate = P2Aggregate
> extends CommandStamp {
  readonly commandType: TCommandType;
  readonly spaceId: UUID;
  readonly expectedRevisions: readonly RevisionExpectation[];
  readonly aggregates: readonly (TAggregate | AccountAggregate | FinancialRevisionAggregate)[];
}

/** Erzeugt Metadaten für ein neues vollständiges Aggregat ohne Systemzeit- oder Zufallszugriff. */
export function createAggregateMetadata(
  spaceId: UUID,
  dependencies: DomainDependencies
): AggregateMetadata {
  assertUuid(spaceId, 'Die Bereichs-ID');
  const id = generatedId(dependencies, 'Die erzeugte Aggregat-ID');
  const now = generatedTime(dependencies, 'Der erzeugte Aggregatzeitpunkt');

  return Object.freeze({
    id,
    spaceId,
    revision: 1 as Revision,
    createdAt: now,
    updatedAt: now
  });
}

/** Erhöht ein vollständiges Aggregat mit einem injizierten UTC-Zeitpunkt um genau eine Revision. */
export function reviseAggregate<TAggregate extends P2Aggregate>(
  aggregate: TAggregate,
  dependencies: DomainDependencies
): TAggregate {
  assertAggregate(aggregate);
  if (aggregate.revision === Number.MAX_SAFE_INTEGER) {
    throw new DomainValidationError(
      'REVISION_OVERFLOW',
      'Die Aggregatrevision kann nicht mehr sicher erhöht werden.'
    );
  }
  const updatedAt = generatedTime(dependencies, 'Der erzeugte Änderungszeitpunkt');
  if (updatedAt < aggregate.createdAt) {
    throw new DomainValidationError(
      'INVALID_GENERATOR',
      'Der erzeugte Änderungszeitpunkt liegt vor dem Erstellungszeitpunkt.'
    );
  }

  return Object.freeze({
    ...aggregate,
    revision: (aggregate.revision + 1) as Revision,
    updatedAt
  }) as TAggregate;
}

/**
 * Prüft sämtliche Mutation- und Revisionsbeziehungen, bevor eine Änderungsmenge
 * entsteht. Ein Fehler gibt deshalb niemals ein Teiländerungsset zurück.
 */
export function createChangeSet<
  TCommandType extends P2CommandType,
  TAggregate extends P2Aggregate
>(
  input: FullCommandInput<TCommandType, TAggregate>,
  heads: AggregateHeadReader,
  dependencies: DomainDependencies
): DomainChangeSet<TCommandType, TAggregate> {
  assertCommandInput(input);
  const expectedById = validateExpectations(input.expectedRevisions, input.spaceId, heads);
  const aggregates = validateMutations(input, expectedById, heads);
  const financial = ['payee.merge', 'reconciliation.confirm', 'reconciliation.unlock'].includes(input.commandType) ? { aggregates, expectedRevisions: input.expectedRevisions } : validateFinancialMutation(input.spaceId, aggregates, input.expectedRevisions, heads, dependencies);
  // Auch hinzugefügte CAS-Anker müssen dieselben Revisionsverträge erfüllen.
  const finalized = { ...input, expectedRevisions: financial.expectedRevisions, mutations: financial.aggregates.map(aggregate => ({ aggregate })) };
  const finalExpected = validateExpectations(finalized.expectedRevisions, input.spaceId, heads);
  const finalAggregates = validateMutations(finalized, finalExpected, heads);
  const stamp = createCommandStamp(dependencies);

  return Object.freeze({
    ...stamp,
    commandType: input.commandType,
    spaceId: input.spaceId,
    expectedRevisions: Object.freeze([...financial.expectedRevisions]),
    aggregates: Object.freeze(finalAggregates) as readonly (TAggregate | AccountAggregate | FinancialRevisionAggregate)[]
  });
}

function createCommandStamp(dependencies: DomainDependencies): CommandStamp {
  return Object.freeze({
    operationId: generatedId(dependencies, 'Die erzeugte Operations-ID'),
    occurredAt: generatedTime(dependencies, 'Der erzeugte Operationszeitpunkt')
  });
}

function validateExpectations(
  expectations: readonly RevisionExpectation[],
  spaceId: UUID,
  heads: AggregateHeadReader
): ReadonlyMap<UUID, Revision> {
  if (!Array.isArray(expectations)) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Die erwarteten Revisionen müssen vollständig angegeben werden.'
    );
  }

  const expectedById = new Map<UUID, Revision>();
  for (const expectation of expectations) {
    if (!isRecord(expectation)) {
      throw new DomainValidationError('INVALID_COMMAND', 'Eine erwartete Revision ist ungültig.');
    }

    assertUuid(expectation.id, 'Die Aggregat-ID einer erwarteten Revision');
    assertRevision(expectation.expectedRevision, 'Die erwartete Revision');

    if (expectedById.has(expectation.id)) {
      throw new DomainValidationError(
        'DUPLICATE_REFERENCE',
        'Jede Aggregatrevision darf in einem Befehl nur einmal erwartet werden.'
      );
    }

    const head = heads.get(expectation.id);
    if (head !== undefined) {
      assertHead(head);
      if (head.spaceId !== spaceId) {
        throw new DomainValidationError(
          'CROSS_SPACE_REFERENCE',
          'Eine erwartete Aggregatrevision verweist auf einen anderen Bereich.'
        );
      }
      if (expectation.expectedRevision !== head.revision) {
        throw new DomainValidationError(
          'REVISION_CONFLICT',
          'Eine erwartete Aggregatrevision ist nicht mehr aktuell.'
        );
      }
    } else if (expectation.expectedRevision !== 0) {
      throw new DomainValidationError(
        'REVISION_CONFLICT',
        'Eine erwartete Aggregatrevision verweist auf kein vorhandenes Aggregat.'
      );
    }

    expectedById.set(expectation.id, expectation.expectedRevision);
  }

  return expectedById;
}

function validateMutations<TAggregate extends P2Aggregate>(
  input: FullCommandInput<P2CommandType, TAggregate>,
  expectedById: ReadonlyMap<UUID, Revision>,
  heads: AggregateHeadReader
): TAggregate[] {
  if (!Array.isArray(input.mutations) || input.mutations.length === 0) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      'Ein Fachbefehl benötigt mindestens ein vollständiges Aggregat.'
    );
  }

  const aggregateIds = new Set<UUID>();
  const validated: TAggregate[] = [];
  for (const mutation of input.mutations) {
    if (!isRecord(mutation)) {
      throw new DomainValidationError('INVALID_COMMAND', 'Eine Aggregatmutation ist ungültig.');
    }

    const aggregate = mutation.aggregate;
    assertAggregate(aggregate);
    if (aggregate.spaceId !== input.spaceId) {
      throw new DomainValidationError(
        'CROSS_SPACE_REFERENCE',
        'Ein vollständiges Aggregat verweist auf einen anderen Bereich.'
      );
    }
    if (aggregateIds.has(aggregate.id)) {
      throw new DomainValidationError(
        'DUPLICATE_REFERENCE',
        'Ein Aggregat darf in einer Änderungsmenge nur einmal vorkommen.'
      );
    }

    const expectedRevision = expectedById.get(aggregate.id);
    if (expectedRevision === undefined) {
      throw new DomainValidationError(
        'REVISION_MISSING',
        'Für jedes geänderte Aggregat muss eine erwartete Revision angegeben sein.'
      );
    }

    validateRevisionTransition(aggregate, expectedRevision, heads.get(aggregate.id));
    aggregateIds.add(aggregate.id);
    validated.push(Object.freeze({ ...aggregate }) as TAggregate);
  }

  return validated;
}

function validateRevisionTransition(
  aggregate: P2Aggregate,
  expectedRevision: Revision,
  current: AggregateHead | undefined
): void {
  if (expectedRevision === 0) {
    if (current !== undefined) {
      throw new DomainValidationError(
        'REVISION_CONFLICT',
        'Ein bereits vorhandenes Aggregat kann nicht mit Revision null angelegt werden.'
      );
    }
    if (aggregate.revision !== 1) {
      throw new DomainValidationError(
        'REVISION_CONFLICT',
        'Ein neues Aggregat muss mit Revision eins beginnen.'
      );
    }
    return;
  }

  if (current === undefined || current.revision !== expectedRevision) {
    throw new DomainValidationError(
      'REVISION_CONFLICT',
      'Die erwartete Aggregatrevision ist nicht mehr aktuell.'
    );
  }
  assertHead(current);
  if (current.spaceId !== aggregate.spaceId || current.aggregateType !== aggregate.aggregateType) {
    throw new DomainValidationError(
      'CROSS_SPACE_REFERENCE',
      'Die Aggregatrevision passt nicht zum Bereich oder Aggregattyp des Befehls.'
    );
  }
  if (expectedRevision === Number.MAX_SAFE_INTEGER) {
    throw new DomainValidationError(
      'REVISION_OVERFLOW',
      'Die Aggregatrevision kann nicht mehr sicher erhöht werden.'
    );
  }
  if (aggregate.revision !== expectedRevision + 1) {
    throw new DomainValidationError(
      'REVISION_CONFLICT',
      'Die neue Aggregatrevision muss genau um eins steigen.'
    );
  }
}

function assertCommandInput(input: FullCommandInput): void {
  if (!isRecord(input)) {
    throw new DomainValidationError('INVALID_COMMAND', 'Der Fachbefehl ist ungültig.');
  }
  if (!p2CommandTypes.includes(input.commandType)) {
    throw new DomainValidationError('INVALID_COMMAND', 'Der Fachbefehlstyp ist nicht bekannt.');
  }
  assertUuid(input.spaceId, 'Die Bereichs-ID des Fachbefehls');
}

function assertAggregate(value: unknown): asserts value is P2Aggregate {
  if (!isRecord(value)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Das vollständige Aggregat ist ungültig.');
  }
  if (!p2AggregateTypes.includes(value.aggregateType as P2AggregateType)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Aggregattyp ist nicht bekannt.');
  }
  assertUuid(value.id, 'Die Aggregat-ID');
  assertUuid(value.spaceId, 'Die Bereichs-ID des Aggregats');
  if (!positiveRevisionSchema.safeParse(value.revision).success) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Die neue Aggregatrevision muss eine positive sichere Ganzzahl sein.'
    );
  }
  assertTimestamp(value.createdAt, 'Der Erstellungszeitpunkt');
  assertTimestamp(value.updatedAt, 'Der Änderungszeitpunkt');
  if (value.createdAt > value.updatedAt) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      'Der Änderungszeitpunkt darf nicht vor dem Erstellungszeitpunkt liegen.'
    );
  }
  if (value.deletedAt !== undefined) {
    assertTimestamp(value.deletedAt, 'Der Löschzeitpunkt');
  }
}

function assertHead(value: AggregateHead): void {
  assertUuid(value.id, 'Die Kopfstands-ID');
  assertUuid(value.spaceId, 'Die Bereichs-ID des Kopfstands');
  assertRevision(value.revision, 'Die Kopfstandsrevision');
  if (!p2AggregateTypes.includes(value.aggregateType)) {
    throw new DomainValidationError('INVALID_AGGREGATE', 'Der Kopfstandsaggregattyp ist nicht bekannt.');
  }
}

function assertUuid(value: unknown, field: string): asserts value is UUID {
  if (!uuidSchema.safeParse(value).success) {
    throw new DomainValidationError('INVALID_COMMAND', `${field} muss eine UUID sein.`);
  }
}

function assertRevision(value: unknown, field: string): asserts value is Revision {
  if (!revisionSchema.safeParse(value).success) {
    throw new DomainValidationError(
      'INVALID_COMMAND',
      `${field} muss eine nichtnegative sichere Ganzzahl sein.`
    );
  }
}

function assertTimestamp(value: unknown, field: string): asserts value is UtcTimestamp {
  if (!utcTimestampSchema.safeParse(value).success) {
    throw new DomainValidationError(
      'INVALID_AGGREGATE',
      `${field} muss ein UTC-Zeitpunkt mit Z sein.`
    );
  }
}

function generatedId(dependencies: DomainDependencies, field: string): UUID {
  try {
    const id = dependencies.ids.next();
    if (!uuidSchema.safeParse(id).success) {
      throw new Error('ungültige UUID');
    }
    return id;
  } catch {
    throw new DomainValidationError('INVALID_GENERATOR', `${field} ist ungültig.`);
  }
}

function generatedTime(dependencies: DomainDependencies, field: string): UtcTimestamp {
  try {
    const timestamp = dependencies.clock.now();
    if (!utcTimestampSchema.safeParse(timestamp).success) {
      throw new Error('ungültiger UTC-Zeitpunkt');
    }
    return timestamp;
  } catch {
    throw new DomainValidationError('INVALID_GENERATOR', `${field} ist ungültig.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
