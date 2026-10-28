import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { eq } from 'drizzle-orm'
import type { AccessConfig } from '../../shared/schemas/access'
import { openDatabase, type Connection } from './client'
import { workspaces } from './schema'

export function migrateDatabase(path: string, access: AccessConfig, folder = './migrations') {
  mkdirSync(dirname(path), { recursive: true })
  const connection = openDatabase(path)
  try {
    migrate(connection.db, { migrationsFolder: folder })
    connection.db.transaction(tx => {
      for (const workspace of access.workspaces) tx.insert(workspaces).values(workspace).onConflictDoUpdate({ target: workspaces.id, set: { name: workspace.name, currency: workspace.currency } }).run()
    })
    verifyDatabase(connection, folder)
  } finally { connection.sqlite.close() }
}

export function verifyDatabase(connection: Connection, folder = './migrations') {
  const expected = readMigrationFiles({ migrationsFolder: folder })
  const actual = connection.sqlite.prepare('SELECT hash FROM __drizzle_migrations ORDER BY id').all() as { hash: string }[]
  if (actual.length !== expected.length || actual.some((row, index) => row.hash !== expected[index]!.hash)) throw new Error('Database migrations do not match this application')
  if (connection.sqlite.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Database integrity check failed')
  if ((connection.sqlite.pragma('foreign_key_check') as unknown[]).length) throw new Error('Foreign key check failed')
}

export function verifyWorkspaces(connection: Connection, access: AccessConfig) {
  for (const workspace of access.workspaces) {
    const row = connection.db.select().from(workspaces).where(eq(workspaces.id, workspace.id)).get()
    if (!row || row.name !== workspace.name || row.currency !== workspace.currency) throw new Error('Run migrate after changing workspace configuration')
  }
}
