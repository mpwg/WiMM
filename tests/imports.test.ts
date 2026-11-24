import { afterEach, beforeEach, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { accounts, bookings, imports } from '../server/db/schema'
import { confirmImport, getImport, previewImport } from '../server/modules/imports/service'
import type { ImportMapping } from '../shared/schemas/imports'
import { storageFixture } from './storage-fixture'

let fixture: ReturnType<typeof storageFixture>
beforeEach(() => { fixture = storageFixture() })
afterEach(() => fixture.dispose())

function mapping(): ImportMapping {
  return {
    accountId: fixture.accountId, dateColumn: 0, amountColumn: 1, descriptionColumn: 2, categoryColumn: 3,
    hasHeader: true, delimiter: ';', decimalSeparator: ',', dateFormat: 'DD.MM.YYYY',
  }
}

const csv = (rows: string) => new TextEncoder().encode(`\uFEFFDatum;Betrag;Beschreibung;Kategorie\r\n${rows}`)

test('Import previews normalize dates, decimal cents and category names before writing', () => {
  const { connection, context, categoryId } = fixture
  const result = previewImport(connection, context, csv('29.02.2024;-12,34;"Brot; Käse";Lebensmittel\r\n'), mapping())
  expect(result.rows).toEqual([{ row: 2, date: '2024-02-29', amountCents: '-1234', description: 'Brot; Käse', categoryId }])
  expect(result.errors).toEqual([])
  expect(connection.db.select().from(bookings).all()).toHaveLength(1)
  expect(getImport(connection, context, result.id)).toEqual(result)
})

test('unknown categories and invalid dates block confirmation until intentionally resolved', () => {
  const { connection, context } = fixture
  const result = previewImport(connection, context, csv('29.02.2025;1,01;Einkauf;Unbekannt\r\n'), mapping())
  expect(result.errors.map(error => [error.row, error.field])).toEqual([[2, 'date'], [2, 'category']])
  expect(() => confirmImport(connection, context, result.id)).toThrow(expect.objectContaining({ statusCode: 422 }))
  const resolved = previewImport(connection, context, csv('28.02.2025;1,01;Einkauf;Unbekannt\r\n'), {
    ...mapping(), categoryMapping: { Unbekannt: null },
  })
  expect(resolved.rows[0]?.categoryId).toBeNull()
  expect(resolved.errors).toHaveLength(0)
})

test('confirmation is atomic and idempotent and a second identical upload is flagged', () => {
  const { connection, context } = fixture
  const raw = csv('28.02.2025;1,01;Einkauf;Lebensmittel\r\n28.02.2025;1,01;Einkauf;Lebensmittel\r\n')
  const preview = previewImport(connection, context, raw, mapping())
  const result = confirmImport(connection, context, preview.id)
  expect(result.status).toBe('confirmed')
  expect(result.result).toHaveLength(2)
  expect(confirmImport(connection, context, preview.id)).toEqual(result)
  expect(connection.db.select().from(bookings).all()).toHaveLength(3)
  const duplicate = previewImport(connection, context, raw, mapping())
  expect(duplicate.duplicate).toBe(true)
  expect(confirmImport(connection, context, duplicate.id).result).toHaveLength(2)
  expect(connection.db.select().from(bookings).all()).toHaveLength(5)
})

test('preview ownership and active references are checked at confirmation', () => {
  const { connection, context, otherUserId, otherWorkspaceId, otherAccountId, accountId } = fixture
  const raw = csv('28.02.2025;1,01;Einkauf;Lebensmittel\r\n')
  const preview = previewImport(connection, context, raw, mapping())
  expect(() => getImport(connection, { ...context, userId: otherUserId }, preview.id)).toThrow(expect.objectContaining({ statusCode: 404 }))
  expect(() => confirmImport(connection, { ...context, workspaceId: otherWorkspaceId }, preview.id)).toThrow(expect.objectContaining({ statusCode: 404 }))
  expect(() => previewImport(connection, context, raw, { ...mapping(), accountId: otherAccountId })).toThrow(expect.objectContaining({ statusCode: 404 }))
  connection.db.update(accounts).set({ archived: true }).where(eq(accounts.id, accountId)).run()
  expect(() => confirmImport(connection, context, preview.id)).toThrow(expect.objectContaining({ statusCode: 422 }))
  expect(connection.db.select().from(bookings).all()).toHaveLength(1)
})

test('expired previews return 410 and a later import removes them', () => {
  const { connection, context } = fixture
  const raw = csv('28.02.2025;1,01;Einkauf;Lebensmittel\r\n')
  const initial = previewImport(connection, context, raw, mapping(), 0)
  expect(() => confirmImport(connection, context, initial.id)).toThrow(expect.objectContaining({ statusCode: 410 }))
  previewImport(connection, context, raw, mapping())
  expect(connection.db.select().from(imports).where(eq(imports.id, initial.id)).get()).toBeUndefined()
})

test('import size, row and encoding limits are enforced', () => {
  const { connection, context } = fixture
  expect(() => previewImport(connection, context, new Uint8Array(5 * 1024 * 1024 + 1), mapping())).toThrow(expect.objectContaining({ statusCode: 413 }))
  expect(() => previewImport(connection, context, csv('28.02.2025;1,01;Einkauf;\r\n'.repeat(5001)), mapping())).toThrow(expect.objectContaining({ statusCode: 413 }))
  expect(() => previewImport(connection, context, Uint8Array.of(0xff), mapping())).toThrow(expect.objectContaining({ statusCode: 422 }))
})
