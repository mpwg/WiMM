import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../server/db/client'
import { migrateDatabase } from '../server/db/lifecycle'
import { accounts, bookings, categories, identities } from '../server/db/schema'
import type { AccessContext } from '../server/modules/identity/access'

export function storageFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'wimm-storage-'))
  const access = {
    workspaces: [
      { id: crypto.randomUUID(), name: 'Haushalt', currency: 'EUR' as const },
      { id: crypto.randomUUID(), name: 'Verein', currency: 'EUR' as const },
    ],
    groupMappings: [],
  }
  const config = { databasePath: join(dir, 'wimm.sqlite'), receiptsPath: join(dir, 'receipts'), access }
  migrateDatabase(config.databasePath, config.access)
  const connection = openDatabase(config.databasePath)
  const { db } = connection
  const userId = crypto.randomUUID()
  const otherUserId = crypto.randomUUID()
  const workspaceId = access.workspaces[0]!.id
  const otherWorkspaceId = access.workspaces[1]!.id
  const accountId = crypto.randomUUID()
  const otherAccountId = crypto.randomUUID()
  const categoryId = crypto.randomUUID()
  const otherCategoryId = crypto.randomUUID()
  const bookingId = crypto.randomUUID()
  const context: AccessContext = { userId, workspaceId, role: 'editor' }
  db.insert(identities).values([
    { id: userId, issuer: 'fixture', subject: 'first', displayName: 'Erste Person' },
    { id: otherUserId, issuer: 'fixture', subject: 'second', displayName: 'Zweite Person' },
  ]).run()
  db.insert(accounts).values([
    { id: accountId, workspaceId, name: 'Konto' },
    { id: otherAccountId, workspaceId: otherWorkspaceId, name: 'Fremdes Konto' },
  ]).run()
  db.insert(categories).values([
    { id: categoryId, workspaceId, name: 'Lebensmittel' },
    { id: otherCategoryId, workspaceId: otherWorkspaceId, name: 'Fremde Kategorie' },
  ]).run()
  db.insert(bookings).values({
    id: bookingId, workspaceId, accountId, date: '2026-09-10', amountCents: -1234n,
    description: 'Einkauf', createdBy: userId, updatedAt: Date.now(),
  }).run()
  return {
    dir, config, connection, context, otherUserId, otherWorkspaceId, accountId, otherAccountId, categoryId, otherCategoryId, bookingId,
    dispose() {
      connection.sqlite.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
