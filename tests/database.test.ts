import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrateDatabase, verifyDatabase } from '../server/db/lifecycle'
import { openDatabase, type Connection } from '../server/db/client'
import { accounts, bookings, categories, identities, receipts, workspaces } from '../server/db/schema'
const dirs: string[] = []
const connections: Connection[] = []
afterEach(() => { for (const connection of connections.splice(0)) connection.sqlite.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'wimm-')); dirs.push(dir)
  const path = join(dir, 'test.sqlite')
  const config = { workspaces: [{ id: 'a', name: 'A', currency: 'EUR' as const }], groupMappings: [] }
  migrateDatabase(path, config)
  migrateDatabase(path, config)
  const connection = openDatabase(path); connections.push(connection)
  return connection
}
it('migrates an empty file idempotently and detects mismatching migration history', () => {
  const connection = setup()
  verifyDatabase(connection)
  expect(Number(connection.sqlite.pragma('foreign_keys', { simple: true }))).toBe(1)
  expect(connection.sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
  expect(Number(connection.sqlite.pragma('synchronous', { simple: true }))).toBe(2)
  connection.sqlite.exec("UPDATE __drizzle_migrations SET hash = 'wrong'")
  expect(() => verifyDatabase(connection)).toThrow('migrations')
})
it('enforces workspace foreign keys, integer money and conditional versions', () => {
  const { db, sqlite } = setup()
  db.insert(workspaces).values({ id: 'b', name: 'B' }).run()
  db.insert(identities).values({ id: 'user', issuer: 'issuer', subject: 'subject', displayName: 'User' }).run()
  db.insert(accounts).values([{ id: 'account-a', workspaceId: 'a', name: 'A' }, { id: 'account-b', workspaceId: 'b', name: 'B' }]).run()
  db.insert(categories).values({ id: 'category-b', workspaceId: 'b', name: 'B' }).run()
  const booking = { id: 'booking', workspaceId: 'a', accountId: 'account-a', date: '2026-10-28', amountCents: 9223372036854775807n, description: '', createdBy: 'user', updatedAt: Date.now() }
  expect(() => db.insert(bookings).values({ ...booking, accountId: 'account-b' }).run()).toThrow()
  expect(() => db.insert(bookings).values({ ...booking, categoryId: 'category-b' }).run()).toThrow()
  expect(() => db.insert(bookings).values({ ...booking, amountCents: 0n }).run()).toThrow()
  db.insert(bookings).values(booking).run()
  expect(db.select().from(bookings).where(eq(bookings.id, 'booking')).get()!.amountCents).toBe(9223372036854775807n)
  expect(sqlite.prepare('UPDATE bookings SET version = version + 1 WHERE id = ? AND version = ?').run('booking', 1).changes).toBe(1)
  expect(sqlite.prepare('UPDATE bookings SET version = version + 1 WHERE id = ? AND version = ?').run('booking', 1).changes).toBe(0)
  expect(() => db.insert(receipts).values({ id: 'receipt', workspaceId: 'b', bookingId: 'booking', storageKey: 'key', originalName: 'x.pdf', mediaType: 'application/pdf', size: 1, status: 'ready' }).run()).toThrow()
})
