// SPDX-License-Identifier: AGPL-3.0-or-later
// Gemeinsamer synthetischer Katalog für echte Browser-IndexedDB und Rust/SQLite.
import type { UUID } from '../../../packages/contracts/src/index.js';
import { canonicalJsonBytes, createEncryptedJsonSnapshotProtector } from '../../../packages/crypto/src/index.js';
import type { P2Aggregate } from '../../../packages/domain/src/index.js';
import { LocalAreaService, toStoredAggregate, type LocalSnapshot, type LocalStorageAdapter } from '../../../packages/storage/src/index.js';

export const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}` as UUID;
export const profileId = id(1), spaceId = id(2), epoch = id(3);
const now = '2026-10-08T10:00:00Z';
const meta = (n: number) => ({ id: id(n), spaceId, revision: 1, createdAt: now, updatedAt: now });
function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }
export function equal(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown) => new TextDecoder().decode(canonicalJsonBytes(JSON.parse(JSON.stringify(value))));
  return canonical(left) === canonical(right);
}
export function normalized(snapshot: LocalSnapshot): LocalSnapshot {
  return { ...snapshot, aggregates: snapshot.aggregates.toSorted((a, b) => a.id.localeCompare(b.id)), confirmed: snapshot.confirmed.toSorted((a, b) => a.aggregate.id.localeCompare(b.aggregate.id)), pending: snapshot.pending.toSorted((a, b) => a.operationId.localeCompare(b.operationId)), projections: snapshot.projections.toSorted((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`)) };
}
export function p5Snapshot(): LocalSnapshot {
  const account = { ...meta(10), aggregateType: 'account' as const, name: 'Synthetisches Quellkonto', type: 'checking' as const, onBudget: true, archived: false };
  const second = { ...account, ...meta(11), name: 'Späteres Buchungskonto' };
  const group = { ...meta(12), aggregateType: 'categoryGroup' as const, name: 'Ausgaben', kind: 'expense' as const, sortOrder: 0, archived: false };
  const category = { ...meta(13), aggregateType: 'category' as const, name: 'Testkategorie', groupId: group.id, sortOrder: 0, archived: false };
  const payee = { ...meta(14), aggregateType: 'payee' as const, name: 'Synthetischer Empfänger', aliases: ['Testalias'], archived: true };
  const template = { accountId: account.id, amount: -100, kind: 'normal' as const, clearance: 'cleared' as const, payeeId: payee.id, note: 'Originalnotiz', splits: [{ id: id(50), categoryId: category.id, amount: -100 }] };
  const schedule = { ...meta(15), aggregateType: 'schedule' as const, startDate: '2026-10-08', frequency: 'monthly' as const, interval: 1, enabled: true, template };
  const occurrence = { ...meta(16), aggregateType: 'scheduleOccurrence' as const, scheduleId: schedule.id, dueDate: '2026-10-08', state: 'confirmed' as const, transactionId: id(17) };
  // Zahlungsdatum und Quellkonto dürfen von Fälligkeit und aktuellem Buchungskonto abweichen.
  const transaction = { ...meta(17), aggregateType: 'transaction' as const, ...template, accountId: second.id, date: '2026-10-09', scheduleOccurrenceId: occurrence.id, importReference: 'synthetische-quellreferenz' };
  const batch = { ...meta(18), aggregateType: 'importBatch' as const, fileHash: 'a'.repeat(64), accountId: account.id, rows: [{ sourceRow: 1, candidate: { sourceRow: 1, parserSource: 'csv' as const, date: transaction.date, amount: -100, categoryId: category.id, payeeId: payee.id }, decision: 'import' as const, issues: [] }], committedRows: [1], state: 'completed' as const };
  const fingerprint = { ...meta(19), aggregateType: 'importFingerprint' as const, accountId: account.id, parserSource: 'csv', externalId: 'synthetische-externe-id', fingerprint: 'synthetischer-fingerprint', transactionId: transaction.id, importId: batch.id, sourceRow: 1 };
  const mapping = { ...meta(20), aggregateType: 'importMapping' as const, name: 'CSV-Testmapping', mapping: { delimiter: ';', date: 'Datum', amount: 'Betrag' } };
  const rule = { ...meta(21), aggregateType: 'rule' as const, order: 0, conditions: [{ field: 'memo' as const, operator: 'contains' as const, value: 'Test' }], actions: [{ field: 'categoryId' as const, value: category.id }], enabled: true, stopProcessing: true };
  const deleted = { ...transaction, ...meta(22), scheduleOccurrenceId: undefined, importReference: undefined, deletedAt: now };
  const skipped = { ...meta(23), aggregateType: 'scheduleOccurrence' as const, scheduleId: schedule.id, dueDate: '2026-11-08', state: 'skipped' as const };
  const partial = { ...batch, ...meta(24), state: 'partial' as const, rows: [...batch.rows, { sourceRow: 2, candidate: null, decision: 'exclude' as const, issues: ['Synthetischer Parserfehler'] }] };
  const aggregates: readonly P2Aggregate[] = [skipped, partial, account, second, group, category, payee, schedule, occurrence, transaction, batch, fingerprint, mapping, rule, deleted];
  // Fachlich veraltete Entwürfe sind Originaldaten; sie dürfen nicht automatisch angewandt werden.
  const draft = { commandType: 'transaction.save', spaceId, aggregates: [{ ...transaction, amount: -101 }], originalInput: { amount: '-1,01', note: 'Unbestätigter Originalentwurf' } };
  return { storageSchemaVersion: 1, domainSchemaVersion: 1, profileId, spaceId, epoch, aggregates: aggregates.map(toStoredAggregate), confirmed: aggregates.map((aggregate) => ({ spaceId, epoch, aggregate: toStoredAggregate(aggregate) })), pending: ['queued', 'sending', 'accepted', 'conflict', 'blocked', 'forbidden', 'invalid'].map((state, i) => ({ operationId: id(70 + i), spaceId, expectedRevisions: [{ handle: transaction.id, expectedRevision: 1 }], dependsOn: i === 0 ? [] : [id(70)], state: state as LocalSnapshot['pending'][number]['state'], draft, retryCount: i })), projections: [{ spaceId, kind: 'balance', key: account.id, payload: 0 }, { spaceId, kind: 'accountBalance', key: second.id, payload: { balance: -100 } }, { spaceId, kind: 'consumption', key: '2026-10', payload: { income: 0, expense: 100, net: -100, categories: [{ categoryId: category.id, groupKind: 'expense', amount: -100 }] } }], syncState: { profileId, spaceId, epoch, cursor: '42' } };
}
export interface SnapshotFixture { readonly storage: LocalStorageAdapter; forProfile(profile: UUID): LocalStorageAdapter; restart(): Promise<LocalStorageAdapter>; close(): Promise<void> }
export const snapshotCases = ['lokal-leer', 'p5-entwürfe-neustart', 'negative-inhalte', 'profil-bereich-handles'] as const;
export type SnapshotCase = typeof snapshotCases[number];
export async function runSnapshotCase(scenario: SnapshotCase, fixture: SnapshotFixture): Promise<void> {
  let storage = fixture.storage;
  const protector = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(7));
  const wrong = createEncryptedJsonSnapshotProtector<LocalSnapshot>(new Uint8Array(32).fill(8));
  let service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: epoch });
  try {
    if (scenario === 'lokal-leer') {
      const bytes = await service.exportEncryptedSnapshot(protector);
      const before = await protector.unseal(bytes);
      check(before.epoch === epoch && before.aggregates.length === 0 && before.pending.length === 0 && before.syncState === undefined, 'Leerer lokaler Snapshot benötigt keine Serverbindung.');
      storage = await fixture.restart(); service = new LocalAreaService(storage, spaceId, { connected: false, initialEpoch: id(99) });
      check(equal(before, await protector.unseal(await service.exportEncryptedSnapshot(protector))), 'Lokale Epoche muss echten Speicherneustart überstehen.');
      await service.replaceEncryptedSnapshot(protector, bytes);
      check(equal(before, await storage.exportSnapshot(spaceId)), 'Leerer Roundtrip verändert Metadaten.');
      return;
    }
    const original = p5Snapshot();
    await service.replaceEncryptedSnapshot(protector, await protector.seal(original));
    const before = normalized(await storage.exportSnapshot(spaceId));
    check(equal(before, normalized(original)), 'P5-Bestand/Entwürfe wurden beim Restore verändert.');
    if (scenario === 'p5-entwürfe-neustart') {
      const bytes = await service.exportEncryptedSnapshot(protector);
      check(!new TextDecoder().decode(bytes).includes('Originalnotiz'), 'Export enthält Klartext.');
      let rejected = false;
      try { await service.replaceEncryptedSnapshot(wrong, bytes); } catch { rejected = true; }
      check(rejected && equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Falscher Schlüssel darf nichts verändern.');
      storage = await fixture.restart(); service = new LocalAreaService(storage, spaceId, { connected: false });
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Dateineustart verliert Originalentwürfe.');
      await service.replaceEncryptedSnapshot(protector, bytes);
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Verschlüsselter Roundtrip verändert P5/Entwürfe.');
      return;
    }
    if (scenario === 'negative-inhalte') {
      const first = before.aggregates[0]!;
      const pending = before.pending[0]!;
      const confirmed = before.confirmed[0]!;
      const projection = before.projections[0]!;
      const variants: readonly unknown[] = [
        { ...before, storageSchemaVersion: 999 }, { ...before, domainSchemaVersion: 999 }, { ...before, profileId: id(99) }, { ...before, epoch: 'ungültig' },
        { ...before, aggregates: [{ ...first, spaceId: id(99) }, ...before.aggregates.slice(1)] }, { ...before, aggregates: [{ ...first, handle: id(99) }, ...before.aggregates.slice(1)] },
        { ...before, aggregates: [...before.aggregates, first] }, { ...before, aggregates: [{ ...first, revision: 0 }, ...before.aggregates.slice(1)] },
        { ...before, aggregates: before.aggregates.filter((entry) => entry.aggregateType !== 'category') },
        { ...before, confirmed: [{ ...confirmed, epoch: id(99) }] }, { ...before, confirmed: [confirmed, confirmed] }, { ...before, confirmed: [{ ...confirmed, spaceId: id(99) }] },
        { ...before, pending: [pending, pending] }, { ...before, pending: [{ ...pending, spaceId: id(99) }] }, { ...before, pending: [{ ...pending, expectedRevisions: [{ handle: id(10), expectedRevision: -1 }] }] },
        { ...before, pending: [{ ...pending, draft: { spaceId: id(99) } }] }, { ...before, pending: [{ ...pending, draft: { aggregates: [{ ...first, spaceId: id(99) }] } }] },
        { ...before, pending: [{ ...pending, dependsOn: [id(70), id(70)] }] }, { ...before, pending: [{ ...pending, expectedRevisions: [pending.expectedRevisions[0], pending.expectedRevisions[0]] }] },
        { ...before, projections: [projection, projection] }, { ...before, projections: [{ ...projection, spaceId: id(99) }] }, { ...before, projections: [{ ...projection, payload: { balance: 1 } }] },
        { ...before, projections: [{ ...projection, kind: 'unbekannt' }] }, { ...before, syncState: { ...before.syncState, epoch: id(99) } }, { ...before, syncState: { ...before.syncState, profileId: id(99) } }, { ...before, syncState: { ...before.syncState, spaceId: id(99) } }
      ];
      for (const [index, value] of variants.entries()) {
        let rejected = false;
        try { await service.replaceEncryptedSnapshot(protector, await protector.seal(value as LocalSnapshot)); } catch { rejected = true; }
        check(rejected, `Ungültige Variante ${index} wurde angenommen.`);
        check(equal(before, normalized(await storage.exportSnapshot(spaceId))), `Variante ${index} verändert Originalbestand.`);
      }
      storage = await fixture.restart();
      check(equal(before, normalized(await storage.exportSnapshot(spaceId))), 'Ablehnungen beschädigen dauerhaften Bestand.');
      return;
    }
    const otherSpace = id(98);
    const other = { ...before, spaceId: otherSpace, epoch: id(97), aggregates: [], confirmed: [], pending: [], projections: [], syncState: undefined };
    await storage.replaceSnapshot(other);
    const conflicts = [
      { ...other, aggregates: [{ ...before.aggregates[0]!, spaceId: otherSpace }] },
      { ...other, confirmed: [{ spaceId: otherSpace, epoch: other.epoch, aggregate: { ...before.aggregates[0]!, spaceId: otherSpace } }] },
      { ...other, pending: [{ ...before.pending[0]!, spaceId: otherSpace, draft: { originalInput: 'Synthetischer Altentwurf' } }] }
    ];
    for (const conflicting of conflicts) {
      let rejected = false;
      try { await storage.replaceSnapshot(conflicting); } catch { rejected = true; }
      check(rejected, 'Fremder Bereichshandle muss abgewiesen werden.');
    }
    const foreign = fixture.forProfile(id(96));
    const foreignSnapshot = { ...original, profileId: id(96), syncState: { ...original.syncState!, profileId: id(96) } };
    await foreign.replaceSnapshot(foreignSnapshot);
    check(equal(normalized(foreignSnapshot), normalized(await foreign.exportSnapshot(spaceId))), 'Profiltrennung muss identische Handles erlauben.');
    check(equal(before, normalized(await storage.exportSnapshot(spaceId))) && equal(other, await storage.exportSnapshot(otherSpace)), 'Bereichstrennung wurde verletzt.');
  } finally { await fixture.close(); }
}
