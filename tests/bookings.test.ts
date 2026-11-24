import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../server/db/client'
import { migrateDatabase } from '../server/db/lifecycle'
import { identities } from '../server/db/schema'
import { createBooking, createResource, listBookings, summarizeBookings, updateBooking, updateResource } from '../server/modules/finance/service'

const directory = mkdtempSync(join(tmpdir(), 'wimm-finance-'))
const path = join(directory, 'test.sqlite')
const userId = randomUUID()
const workspaceId = randomUUID()
const otherId = randomUUID()
const context = { userId, workspaceId, role: 'owner' as const }
const other = { ...context, workspaceId: otherId }
let store: ReturnType<typeof openDatabase>

beforeAll(() => {
  migrateDatabase(path, {
    workspaces: [workspaceId, otherId].map(id => ({ id, name: id, currency: 'EUR' as const })),
    groupMappings: [],
  })
  store = openDatabase(path)
  store.db.insert(identities).values({ id: userId, displayName: 'Test', issuer: 'test', subject: 'test' }).run()
})

afterAll(() => {
  store?.sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

test('lists and summarizes only the current workspace with exact money and a stable cursor', () => {
  const account = createResource(store, context, 'accounts', 'Giro')
  const foreign = createResource(store, other, 'accounts', 'Fremd')
  const entry = { date: '2026-11-22', accountId: account.id, categoryId: null, amountCents: '9007199254740995', description: 'Einnahme' }
  createBooking(store, context, entry)
  createBooking(store, context, { ...entry, amountCents: '-3', description: 'Ausgabe' })
  createBooking(store, other, { ...entry, accountId: foreign.id })
  expect(() => createBooking(store, context, { ...entry, accountId: foreign.id })).toThrow()
  const first = listBookings(store, context, { limit: 1 })
  expect(first.items).toHaveLength(1)
  const second = listBookings(store, context, { limit: 1, cursor: first.nextCursor! })
  expect(second.items).toHaveLength(1)
  expect(first.items[0]!.id).not.toBe(second.items[0]!.id)
  expect(second.nextCursor).toBeNull()
  expect(summarizeBookings(store, context, { from: entry.date, to: entry.date })).toEqual({
    incomeCents: '9007199254740995', expenseCents: '-3', balanceCents: '9007199254740992',
  })
})

test('rejects stale changes and preserves an archived account on an existing booking', () => {
  const account = createResource(store, context, 'accounts', 'Kasse')
  const entry = { date: '2026-11-23', accountId: account.id, categoryId: null, amountCents: '-1299', description: '' }
  const booking = createBooking(store, context, entry)
  updateResource(store, context, 'accounts', account.id, { archived: true })
  expect(() => createBooking(store, context, entry)).toThrow()
  expect(updateBooking(store, context, booking.id, { ...entry, description: 'Erledigt', version: 1 }).version).toBe(2)
  expect(() => updateBooking(store, context, booking.id, { ...entry, version: 1 })).toThrow(expect.objectContaining({ code: 'version_conflict' }))
})
