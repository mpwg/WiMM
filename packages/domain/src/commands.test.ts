// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { UUID } from '@wimm/contracts';

import {
  createAggregateMetadata,
  createChangeSet,
  DomainValidationError,
  type AggregateHead,
  type AggregateHeadReader,
  type DomainDependencies,
  type FullCommandInput,
  type P2Aggregate
} from './index.js';

const SPACE = '00000000-0000-4000-8000-000000000001' as UUID;
const OTHER_SPACE = '00000000-0000-4000-8000-000000000002' as UUID;
const ACCOUNT = '00000000-0000-4000-8000-000000000011' as UUID;
const PAYEE = '00000000-0000-4000-8000-000000000012' as UUID;
const OPERATION = '00000000-0000-4000-8000-000000000101' as UUID;
const NEXT_AGGREGATE = '00000000-0000-4000-8000-000000000102' as UUID;
const NOW = '2026-10-03T12:00:00Z';

function aggregate(
  id: UUID,
  revision: number,
  aggregateType: P2Aggregate['aggregateType'] = 'account',
  spaceId = SPACE
): P2Aggregate {
  return {
    id,
    spaceId,
    revision,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType
  } as P2Aggregate;
}

function head(
  id: UUID,
  revision: number,
  aggregateType: AggregateHead['aggregateType'] = 'account',
  spaceId = SPACE
): AggregateHead {
  return { id, spaceId, revision, aggregateType };
}

function reader(...heads: readonly AggregateHead[]): AggregateHeadReader {
  const byId = new Map(heads.map((item) => [item.id, item]));
  return { get: (id) => byId.get(id) };
}

function dependencies(operationId = OPERATION): DomainDependencies {
  return {
    ids: { next: () => operationId },
    clock: { now: () => NOW }
  };
}

function expectDomainError(action: () => unknown, code: DomainValidationError['code']): void {
  try {
    action();
    throw new Error('Es wurde ein Fachfehler erwartet.');
  } catch (error) {
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error).toMatchObject({ code });
  }
}

describe('atomare Fachbefehle', () => {
  it('erzeugt ein vollständiges, deterministisches Mehraggregat-Änderungsset', () => {
    const input: FullCommandInput<'payee.merge'> = {
      commandType: 'payee.merge',
      spaceId: SPACE,
      expectedRevisions: [
        { id: ACCOUNT, expectedRevision: 2 },
        { id: PAYEE, expectedRevision: 7 }
      ],
      mutations: [
        { aggregate: aggregate(ACCOUNT, 3) },
        { aggregate: aggregate(PAYEE, 8, 'payee') }
      ]
    };
    const heads = reader(head(ACCOUNT, 2), head(PAYEE, 7, 'payee'));

    const first = createChangeSet(input, heads, dependencies());
    const second = createChangeSet(input, heads, dependencies());

    expect(first).toEqual(second);
    expect(first).toMatchObject({ operationId: OPERATION, occurredAt: NOW, commandType: 'payee.merge' });
    expect(first.aggregates).toHaveLength(2);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.aggregates)).toBe(true);
  });

  it('lehnt eine fehlende erwartete Revision vor der ID-Erzeugung ab', () => {
    let generated = 0;
    const services: DomainDependencies = {
      ids: {
        next: () => {
          generated += 1;
          return OPERATION;
        }
      },
      clock: { now: () => NOW }
    };
    const input: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [],
      mutations: [{ aggregate: aggregate(ACCOUNT, 1) }]
    };

    expectDomainError(() => createChangeSet(input, reader(), services), 'REVISION_MISSING');
    expect(generated).toBe(0);
  });

  it('lehnt veraltete Revisionen und Revisionen außerhalb des sicheren Bereichs ab', () => {
    const stale: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [{ id: ACCOUNT, expectedRevision: 1 }],
      mutations: [{ aggregate: aggregate(ACCOUNT, 2) }]
    };
    expectDomainError(() => createChangeSet(stale, reader(head(ACCOUNT, 2)), dependencies()), 'REVISION_CONFLICT');

    const atLimit: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [{ id: ACCOUNT, expectedRevision: Number.MAX_SAFE_INTEGER }],
      mutations: [{ aggregate: aggregate(ACCOUNT, Number.MAX_SAFE_INTEGER) }]
    };
    expectDomainError(
      () => createChangeSet(atLimit, reader(head(ACCOUNT, Number.MAX_SAFE_INTEGER)), dependencies()),
      'REVISION_OVERFLOW'
    );

    const staleReadReference: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [
        { id: ACCOUNT, expectedRevision: 2 },
        { id: PAYEE, expectedRevision: 4 }
      ],
      mutations: [{ aggregate: aggregate(ACCOUNT, 3) }]
    };
    expectDomainError(
      () => createChangeSet(staleReadReference, reader(head(ACCOUNT, 2), head(PAYEE, 5, 'payee')), dependencies()),
      'REVISION_CONFLICT'
    );
  });

  it('lehnt bereichsfremde Aggregate und erwartete Kopfstände ab', () => {
    const foreignAggregate: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [{ id: ACCOUNT, expectedRevision: 0 }],
      mutations: [{ aggregate: aggregate(ACCOUNT, 1, 'account', OTHER_SPACE) }]
    };
    expectDomainError(
      () => createChangeSet(foreignAggregate, reader(), dependencies()),
      'CROSS_SPACE_REFERENCE'
    );

    const foreignHead: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [{ id: ACCOUNT, expectedRevision: 1 }],
      mutations: [{ aggregate: aggregate(ACCOUNT, 2) }]
    };
    expectDomainError(
      () => createChangeSet(foreignHead, reader(head(ACCOUNT, 1, 'account', OTHER_SPACE)), dependencies()),
      'CROSS_SPACE_REFERENCE'
    );
  });

  it('liefert bei einem fehlerhaften Teil einer Mehraggregatänderung kein Teiländerungsset', () => {
    let generated = 0;
    const services: DomainDependencies = {
      ids: {
        next: () => {
          generated += 1;
          return OPERATION;
        }
      },
      clock: { now: () => NOW }
    };
    const input: FullCommandInput<'payee.merge'> = {
      commandType: 'payee.merge',
      spaceId: SPACE,
      expectedRevisions: [
        { id: ACCOUNT, expectedRevision: 0 },
        { id: PAYEE, expectedRevision: 1 }
      ],
      mutations: [
        { aggregate: aggregate(ACCOUNT, 1) },
        { aggregate: aggregate(PAYEE, 2, 'payee') }
      ]
    };

    expectDomainError(
      () => createChangeSet(input, reader(head(PAYEE, 2, 'payee')), services),
      'REVISION_CONFLICT'
    );
    expect(generated).toBe(0);
  });

  it('prüft doppelte Referenzen und unvollständige Aggregate', () => {
    const duplicate: FullCommandInput<'account.save'> = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [
        { id: ACCOUNT, expectedRevision: 0 },
        { id: ACCOUNT, expectedRevision: 0 }
      ],
      mutations: [{ aggregate: aggregate(ACCOUNT, 1) }]
    };
    expectDomainError(() => createChangeSet(duplicate, reader(), dependencies()), 'DUPLICATE_REFERENCE');

    const incomplete = {
      commandType: 'account.save',
      spaceId: SPACE,
      expectedRevisions: [{ id: ACCOUNT, expectedRevision: 0 }],
      mutations: [{ aggregate: { id: ACCOUNT, spaceId: SPACE, revision: 1, aggregateType: 'account' } }]
    } as unknown as FullCommandInput<'account.save'>;
    expectDomainError(() => createChangeSet(incomplete, reader(), dependencies()), 'INVALID_AGGREGATE');
  });
});

describe('injizierte Fachabhängigkeiten', () => {
  it('erzeugt neue Aggregatmetadaten ausschließlich aus den injizierten Diensten', () => {
    const metadata = createAggregateMetadata(SPACE, dependencies(NEXT_AGGREGATE));

    expect(metadata).toEqual({
      id: NEXT_AGGREGATE,
      spaceId: SPACE,
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW
    });
  });

  it('lehnt fehlerhafte ID- und Zeitgeneratoren ab', () => {
    expectDomainError(
      () =>
        createAggregateMetadata(SPACE, {
          ids: { next: () => 'keine-uuid' as UUID },
          clock: { now: () => NOW }
        }),
      'INVALID_GENERATOR'
    );
    expectDomainError(
      () =>
        createChangeSet(
          {
            commandType: 'account.save',
            spaceId: SPACE,
            expectedRevisions: [{ id: ACCOUNT, expectedRevision: 0 }],
            mutations: [{ aggregate: aggregate(ACCOUNT, 1) }]
          },
          reader(),
          {
            ids: { next: () => OPERATION },
            clock: { now: () => 'keine-zeit' as never }
          }
        ),
      'INVALID_GENERATOR'
    );
  });
});
