import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

export function openDatabase(path: string) {
  const sqlite = new Database(path, { safeIntegers: true, strict: true })
  try {
    sqlite.exec('PRAGMA foreign_keys = ON')
    sqlite.exec('PRAGMA busy_timeout = 5000')
    sqlite.exec('PRAGMA journal_mode = WAL')
    sqlite.exec('PRAGMA synchronous = FULL')
    return { sqlite, db: drizzle(sqlite, { schema }) }
  } catch (error) { sqlite.close(); throw error }
}
export type Connection = ReturnType<typeof openDatabase>
