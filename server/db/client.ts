import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export function openDatabase(path: string) {
  const sqlite = new Database(path)
  try {
    sqlite.defaultSafeIntegers(true)
    sqlite.pragma('foreign_keys = ON')
    sqlite.pragma('busy_timeout = 5000')
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('synchronous = FULL')
    return { sqlite, db: drizzle(sqlite, { schema }) }
  } catch (error) { sqlite.close(); throw error }
}
export type Connection = ReturnType<typeof openDatabase>
