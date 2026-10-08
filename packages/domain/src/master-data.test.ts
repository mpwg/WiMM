// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { Money, UUID } from '@wimm/contracts';

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
  type PayeeTransactionReference,
  type TransactionAggregate
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
  return { get: (id) => entries.get(id) ?? (id === '00000000-0000-4000-8000-000000000999' ? { id, spaceId: SPACE, revision: 1, aggregateType: 'categoryGroup' as const } : undefined), list: () => [
    ...heads.filter(h => ['payee', 'categoryGroup'].includes(h.aggregateType)).map(h => ({ ...h, createdAt: NOW, updatedAt: NOW })),
    ...heads.filter(h => h.aggregateType === 'account').map(h => ({ ...h, createdAt: NOW, updatedAt: NOW })),
    ...heads.filter(h => h.aggregateType === 'category').map(h => ({ ...h, createdAt: NOW, updatedAt: NOW, groupId: '00000000-0000-4000-8000-000000000999' })),
    { id: '00000000-0000-4000-8000-000000000999', spaceId: SPACE, revision: 1, createdAt: NOW, updatedAt: NOW, aggregateType: 'categoryGroup', kind: 'expense' }
  ] };
}

function withTransactions(base: AggregateHeadReader, ...transactions: readonly TransactionAggregate[]): AggregateHeadReader {
  return { ...base, list: (spaceId) => [...base.list!(spaceId), ...transactions] };
}

function storedTransaction(reference: PayeeTransactionReference): TransactionAggregate {
  return { ...reference, accountId: ACCOUNT, date: '2026-10-03', amount: -100 as Money, kind: 'opening', splits: [] };
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
    expect(saveCategory({
      commandType: 'category.save', spaceId: SPACE,
      expectedRevisions: [{ id: system.id, expectedRevision: 0 }, { id: GROUP, expectedRevision: 1 }],
      mutations: [{ aggregate: system }]
    }, reader(head(GROUP, 1, 'categoryGroup')), dependencies()).aggregates[0]).toMatchObject({ system: 'uncategorized', archived: false });

    const ordinaryId = '00000000-0000-4000-8000-000000000099' as UUID;
    const ordinary = saveCategory({
      commandType: 'category.save', spaceId: SPACE,
      expectedRevisions: [{ id: ordinaryId, expectedRevision: 0 }, { id: GROUP, expectedRevision: 1 }],
      mutations: [{ aggregate: category(1, { id: ordinaryId }) }]
    }, reader(head(GROUP, 1, 'categoryGroup')), dependencies());
    expect(ordinary.aggregates[0]).toMatchObject({ id: ordinaryId, archived: false });

    const base = reader(head(system.id, 1, 'category'), head(GROUP, 1, 'categoryGroup'));
    const storedHeads: AggregateHeadReader = {
      ...base,
      list: (spaceId) => [...base.list!(spaceId).filter((entry) => entry.id !== system.id), system]
    };
    const saveSystem = (aggregate: CategoryAggregate) => saveCategory({
      commandType: 'category.save', spaceId: SPACE,
      expectedRevisions: [{ id: system.id, expectedRevision: 1 }, { id: GROUP, expectedRevision: 1 }],
      mutations: [{ aggregate }]
    }, storedHeads, dependencies());
    const { system: _removedSystem, ...unmarked } = system;
    expectDomainError(() => saveSystem({ ...unmarked, revision: 2 }), 'INVALID_COMMAND');
    expectDomainError(() => saveSystem({ ...system, revision: 2, archived: true }), 'INVALID_COMMAND');
    expectDomainError(() => saveSystem({ ...system, revision: 2, deletedAt: NOW }), 'INVALID_COMMAND');
    expectDomainError(() => archiveCategory({
      commandType: 'category.archive', spaceId: SPACE,
      expectedRevisions: [{ id: system.id, expectedRevision: 1 }, { id: GROUP, expectedRevision: 1 }],
      mutations: [{ aggregate: { ...unmarked, revision: 2, archived: true } }]
    }, storedHeads, dependencies()), 'INVALID_COMMAND');

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
      payeeId: SOURCE, clearance: 'uncleared'
    };
    const merged = mergePayees(
      {
        spaceId: SPACE,
        target: payee(TARGET, 2, 'Markt', ['Bio Markt']),
        sources: [payee(SOURCE, 3, 'Bäckerei', ['Backstube'])],
        transactions: [transaction]
      },
      withTransactions(reader(head(TARGET, 2, 'payee'), head(SOURCE, 3, 'payee'), head(TRANSACTION, 4, 'transaction')), storedTransaction(transaction)),
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
      payeeId: SOURCE, clearance: 'uncleared'
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
          withTransactions(reader(head(TARGET, 2, 'payee'), head(SOURCE, 4, 'payee'), head(TRANSACTION, 4, 'transaction')), storedTransaction(transaction)),
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

  it.each(['uncleared', 'reconciled'] as const)('lehnt ausgelassene gespeicherte Quellbuchungen ohne Teiländerungsset ab: %s', (clearance) => {
    const target = payee(TARGET, 1, 'Ziel');
    const source = payee(SOURCE, 1, 'Quelle');
    const stored = storedTransaction({ id: TRANSACTION, spaceId: SPACE, revision: 1, createdAt: NOW, updatedAt: NOW, aggregateType: 'transaction', payeeId: SOURCE, clearance });
    const input = { spaceId: SPACE, target, sources: [source], transactions: [] };
    const before = structuredClone({ target, source, stored });
    const heads = withTransactions(reader(target, source, stored), stored);
    expectDomainError(() => mergePayees(input, heads, dependencies()), 'INVALID_COMMAND');
    expect({ target, source, stored }).toEqual(before);
  });

  it('bewahrt Tombstones und vollständige Buchungsfelder und schützt die Referenzabfrage per Finanz-CAS', () => {
    const target = payee(TARGET, 1, 'Ziel'); const source = payee(SOURCE, 1, 'Quelle');
    const stored = storedTransaction({ id: TRANSACTION, spaceId: SPACE, revision: 1, createdAt: NOW, updatedAt: NOW, aggregateType: 'transaction', payeeId: SOURCE, clearance: 'cleared' });
    const tombstone = { ...stored, id: CATEGORY, deletedAt: NOW };
    const guard = { id: SPACE, spaceId: SPACE, revision: 7, createdAt: NOW, updatedAt: NOW, aggregateType: 'financialRevision' as const };
    const base = withTransactions(reader(target, source, stored, guard), stored, tombstone);
    const heads = { ...base, list: (spaceId: UUID) => [...base.list!(spaceId), guard] };
    const input = { spaceId: SPACE, target, sources: [source], transactions: [stored] };
    const result = mergePayees(input, heads, dependencies());
    expect(result.expectedRevisions).toContainEqual({ id: SPACE, expectedRevision: 7 });
    expect(result.aggregates.find((aggregate) => aggregate.id === TRANSACTION)).toMatchObject({ ...stored, revision: 2, payeeId: TARGET });
    expect(result.aggregates.find((aggregate) => aggregate.id === tombstone.id)).toBeUndefined();
    expectDomainError(() => mergePayees({ ...input, transactions: [stored, stored] }, heads, dependencies()), 'DUPLICATE_REFERENCE');
    expectDomainError(() => mergePayees({ ...input, transactions: [{ ...stored, revision: 2 }] }, heads, dependencies()), 'REVISION_CONFLICT');
    expectDomainError(() => mergePayees({ ...input, transactions: [{ ...stored, clearance: 'uncleared' }] }, heads, dependencies()), 'REVISION_CONFLICT');
  });
});

it.each([
  ['Markt', 'Markt', [], []],
  ['Äpfel Markt', '  A\u0308PFEL   markt ', ['Bio'], ['BIO']],
  ['Ziel', 'Quelle', ['Quelle', 'Bio'], ['BIO']]
])('vereinigt Empfängernamen und Aliasse eindeutig: %s / %s', (targetName, sourceName, targetAliases, sourceAliases) => {
  const target = payee(TARGET, 1, targetName, targetAliases); const source = payee(SOURCE, 1, sourceName, sourceAliases);
  const result = mergePayees({ spaceId: SPACE, target, sources: [source], transactions: [] }, reader(target, source), dependencies());
  const merged = result.aggregates.find(a => a.id === TARGET) as PayeeAggregate;
  const normalize = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-AT');
  expect(new Set(merged.aliases.map(normalize)).size).toBe(merged.aliases.length);
  expect(merged.aliases.map(normalize)).not.toContain(normalize(merged.name));
});

it('weist abgeglichene Empfängerreferenzen vor Änderungen ab und erlaubt den entsperrten Stand', () => {
  const target = payee(TARGET, 1, 'Ziel'); const source = payee(SOURCE, 1, 'Quelle');
  const transaction: PayeeTransactionReference = { id: TRANSACTION, spaceId: SPACE, revision: 1, createdAt: NOW, updatedAt: NOW, aggregateType: 'transaction', payeeId: SOURCE, clearance: 'reconciled' };
  const input = { spaceId: SPACE, target, sources: [source], transactions: [transaction] };
  const original = structuredClone(input);
  const base = reader(target, source, transaction);
  expect(() => mergePayees(input, withTransactions(base, storedTransaction(transaction)), dependencies())).toThrow('entsperrt'); expect(input).toEqual(original);
  const unlocked = { ...transaction, clearance: 'cleared' as const };
  expect(mergePayees({ ...input, transactions: [unlocked] }, withTransactions(reader(target, source, unlocked), storedTransaction(unlocked)), dependencies()).aggregates.find(a => a.id === TRANSACTION)).toMatchObject({ aggregateType: 'transaction', accountId: ACCOUNT, kind: 'opening', payeeId: TARGET, clearance: 'cleared' });
});
