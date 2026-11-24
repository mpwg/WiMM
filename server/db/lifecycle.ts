import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { eq } from 'drizzle-orm'
import type { AccessConfig } from '../../shared/schemas/access'
import { openDatabase, type Connection } from './client'
import { workspaces } from './schema'

export function migrateDatabase(path: string, access: AccessConfig, folder = './migrations') {
  mkdirSync(dirname(path), { recursive: true })
  const connection = openDatabase(path)
  try {
    verifyMigrationHistory(connection, folder, true)
    migrate(connection.db, { migrationsFolder: folder })
    verifyDatabase(connection, folder)
    connection.db.transaction(tx => {
      for (const workspace of access.workspaces) tx.insert(workspaces).values(workspace).onConflictDoUpdate({ target: workspaces.id, set: { name: workspace.name, currency: workspace.currency } }).run()
    })
  } finally { connection.sqlite.close() }
}

function verifyMigrationHistory(connection: Connection, folder: string, allowPending = false) {
  const expected = readMigrationFiles({ migrationsFolder: folder })
  const hasHistory = connection.sqlite.query("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = '__drizzle_migrations'").get()
  const actual = hasHistory ? connection.sqlite.query<{ hash: string, created_at: bigint }, []>(
    'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, rowid',
  ).all() : []
  if ((!allowPending && actual.length !== expected.length) ||
    actual.some((row, index) => row.hash !== expected[index]?.hash || Number(row.created_at) !== expected[index]?.folderMillis)) {
    throw new Error('Database migrations do not match this application')
  }
}

export function verifyDatabase(connection: Connection, folder = './migrations') {
  verifyMigrationHistory(connection, folder)
  if (connection.sqlite.query('PRAGMA quick_check').values()[0]?.[0] !== 'ok') throw new Error('Database integrity check failed')
  if (connection.sqlite.query('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed')
}

export function verifyWorkspaces(connection: Connection, access: AccessConfig) {
  for (const workspace of access.workspaces) {
    const row = connection.db.select().from(workspaces).where(eq(workspaces.id, workspace.id)).get()
    if (!row || row.name !== workspace.name || row.currency !== workspace.currency) throw new Error('Run migrate after changing workspace configuration')
  }
}
