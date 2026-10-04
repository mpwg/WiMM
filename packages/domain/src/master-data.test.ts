// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { UUID } from '@wimm/contracts';

import {
  archiveAccount,
  archiveCategory,
  createAggregateMetadata,
  createUncategorizedCategory,
  DomainValidationError,
  mergePayees,
  saveAccount,
  saveCategory,
  savePayee,
  type AccountAggregate,
  type AggregateHead,
  type AggregateHeadReader,
  type CategoryAggregate,
  type DomainDependencies,
  type PayeeAggregate,
  type PayeeTransactionReference
} from './index.js';

const SPACE = '00000000-0000-4000-8000-000000000001' as UUID;
const OTHER_SPACE = '00000000-0000-4000-8000-000000000002' as UUID;
const ACCOUNT = '00000000-0000-4000-8000-000000000011' as UUID;
const GROUP = '00000000-0000-4000-8000-000000000012' as UUID;
const CATEGORY = '00000000-0000-4000-8000-000000000013' as UUID;
const TARGET = '00000000-0000-4000-8000-000000000014' as UUID;
const SOURCE = '00000000-0000-4000-8000-000000000015' as UUID;
const TRANSACTION = '00000000-0000-4000-8000-000000000016' as UUID;
const OPERATION = '00000000-0000-4000-8000-000000000101' as UUID;
const NOW = '2026-10-03T12:00:00Z';

function dependencies(): DomainDependencies {
  return { ids: { next: () => OPERATION }, clock: { now: () => NOW } };
}

function reader(...heads: readonly AggregateHead[]): AggregateHeadReader {
  const entries = new Map(heads.map((item) => [item.id, item]));
  return { get: (id) => entries.get(id) };
}

function head(
  id: UUID,
  revision: number,
  aggregateType: AggregateHead['aggregateType'],
  spaceId = SPACE
): AggregateHead {
  return { id, revision, aggregateType, spaceId };
}

function account(revision = 1, overrides: Partial<AccountAggregate> = {}): AccountAggregate {
  return {
    id: ACCOUNT,
    spaceId: SPACE,
    revision,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'account',
    name: '  Girokonto  ',
    type: 'checking',
    onBudget: true,
    archived: false,
    ...overrides
  };
}

function category(revision = 1, overrides: Partial<CategoryAggregate> = {}): CategoryAggregate {
  return {
    id: CATEGORY,
    spaceId: SPACE,
    revision,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'category',
    groupId: GROUP,
    name: 'Lebensmittel',
    sortOrder: 0,
    archived: false,
    ...overrides
  };
}

function payee(
  id: UUID,
  revision: number,
  name: string,
  aliases: readonly string[] = []
): PayeeAggregate {
  return {
    id,
    spaceId: SPACE,
    revision,
    createdAt: NOW,
    updatedAt: NOW,
    aggregateType: 'payee',
    name,
    aliases,
    archived: false
  };
}

function expectDomainError(action: () => unknown, code: DomainValidationError['code']): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DomainValidationError);
  expect(caught).toMatchObject({ code });
}

describe('Konten und Kategorien', () => {
  it('normalisiert ein vollständiges Konto ohne mutablen Saldo', () => {
    const result = saveAccount(
      {
        commandType: 'account.save',
        spaceId: SPACE,
        expectedRevisions: [{ id: ACCOUNT, expectedRevision: 0 }],
        mutations: [{ aggregate: account() }]
      },
      reader(),
      dependencies()
    );

    expect(result.aggregates[0]).toMatchObject({ name: 'Girokonto', onBudget: true });
    expect(result.aggregates[0]).not.toHaveProperty('balance');
  });

  it('hält Kreditkonten off-budget und archiviert nur vollständige Konten', () => {
    expectDomainError(
      () =>
        saveAccount(
          {
            commandType: 'account.save',
            spaceId: SPACE,
            expectedRevisions: [{ id: ACCOUNT, expectedRevision: 0 }],
            mutations: [{ aggregate: account(1, { type: 'credit', onBudget: true }) }]
          },
          reader(),
          dependencies()
        ),
      'INVALID_AGGREGATE'
    );

    const archived = archiveAccount(
      {
        commandType: 'account.archive',
        spaceId: SPACE,
        expectedRevisions: [{ id: ACCOUNT, expectedRevision: 1 }],
        mutations: [{ aggregate: account(2, { archived: true }) }]
      },
      reader(head(ACCOUNT, 1, 'account')),
      dependencies()
    );
    expect(archived.aggregates[0]).toMatchObject({ archived: true, revision: 2 });
  });

  it('verlangt die aktuelle Kategoriegruppenrevision und schützt die Systemkategorie', () => {
    expectDomainError(
      () =>
        saveCategory(
          {
            commandType: 'category.save',
            spaceId: SPACE,
            expectedRevisions: [{ id: CATEGORY, expectedRevision: 0 }],
            mutations: [{ aggregate: category() }]
          },
          reader(head(GROUP, 1, 'categoryGroup')),
          dependencies()
        ),
      'REVISION_MISSING'
    );

    const system = createUncategorizedCategory(
      createAggregateMetadata(SPACE, dependencies()),
      GROUP
    );
    expect(system).toMatchObject({ name: 'Nicht zugeordnet', system: 'uncategorized', archived: false });

    expectDomainError(
      () =>
        archiveCategory(
          {
            commandType: 'category.archive',
            spaceId: SPACE,
            expectedRevisions: [
              { id: system.id, expectedRevision: 1 },
              { id: GROUP, expectedRevision: 1 }
            ],
            mutations: [{ aggregate: { ...system, revision: 2, archived: true } }]
          },
          reader(head(system.id, 1, 'category'), head(GROUP, 1, 'categoryGroup')),
          dependencies()
        ),
      'INVALID_COMMAND'
    );
  });
});

describe('Empfängerzusammenführung', () => {
  it('normalisiert Aliasse und lehnt doppelte Normalformen ab', () => {
    const saved = savePayee(
      {
        commandType: 'payee.save',
        spaceId: SPACE,
        expectedRevisions: [{ id: TARGET, expectedRevision: 0 }],
        mutations: [{ aggregate: payee(TARGET, 1, ' Markt ', ['  Bio   Markt ']) }]
      },
      reader(),
      dependencies()
    );
    expect(saved.aggregates[0]).toMatchObject({ name: 'Markt', aliases: ['Bio Markt'] });

    expectDomainError(
      () =>
        savePayee(
          {
            commandType: 'payee.save',
            spaceId: SPACE,
            expectedRevisions: [{ id: TARGET, expectedRevision: 0 }],
            mutations: [{ aggregate: payee(TARGET, 1, 'Markt', ['markt']) }]
          },
          reader(),
          dependencies()
        ),
      'DUPLICATE_REFERENCE'
    );
  });

  it('archiviert Quellen und schreibt alle übergebenen Empfängerreferenzen atomar um', () => {
    const transaction: PayeeTransactionReference = {
      id: TRANSACTION,
      spaceId: SPACE,
      revision: 4,
      createdAt: NOW,
      updatedAt: NOW,
      aggregateType: 'transaction',
      payeeId: SOURCE
    };
    const merged = mergePayees(
      {
        spaceId: SPACE,
        target: payee(TARGET, 2, 'Markt', ['Bio Markt']),
        sources: [payee(SOURCE, 3, 'Bäckerei', ['Backstube'])],
        transactions: [transaction]
      },
      reader(head(TARGET, 2, 'payee'), head(SOURCE, 3, 'payee'), head(TRANSACTION, 4, 'transaction')),
      dependencies()
    );

    expect(merged.aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: TARGET, revision: 3, aliases: ['Bio Markt', 'Bäckerei', 'Backstube'] }),
        expect.objectContaining({ id: SOURCE, revision: 4, archived: true }),
        expect.objectContaining({ id: TRANSACTION, revision: 5, payeeId: TARGET })
      ])
    );
  });

  it('lehnt eine veraltete oder bereichsfremde Merge-Referenz vollständig ab', () => {
    const transaction: PayeeTransactionReference = {
      id: TRANSACTION,
      spaceId: SPACE,
      revision: 4,
      createdAt: NOW,
      updatedAt: NOW,
      aggregateType: 'transaction',
      payeeId: SOURCE
    };
    const input = {
      spaceId: SPACE,
      target: payee(TARGET, 2, 'Markt'),
      sources: [payee(SOURCE, 3, 'Bäckerei')],
      transactions: [transaction]
    };
    expectDomainError(
      () =>
        mergePayees(
          input,
          reader(head(TARGET, 2, 'payee'), head(SOURCE, 4, 'payee'), head(TRANSACTION, 4, 'transaction')),
          dependencies()
        ),
      'REVISION_CONFLICT'
    );

    expectDomainError(
      () =>
        mergePayees(
          { ...input, sources: [{ ...input.sources[0]!, spaceId: OTHER_SPACE }] },
          reader(),
          dependencies()
        ),
      'INVALID_COMMAND'
    );
  });
});
