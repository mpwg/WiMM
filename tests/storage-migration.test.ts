import { expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../server/db/client'
import { migrateDatabase } from '../server/db/lifecycle'

test('the receipt recovery migration preserves existing bookings and receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wimm-migration-'))
  const previous = join(dir, 'migrations')
  const database = join(dir, 'wimm.sqlite')
  const access = { workspaces: [{ id: 'workspace', name: 'Haushalt', currency: 'EUR' as const }], groupMappings: [] }
  try {
    mkdirSync(join(previous, 'meta'), { recursive: true })
    copyFileSync('migrations/0000_whole_mattie_franklin.sql', join(previous, '0000_whole_mattie_franklin.sql'))
    const journal = require('../migrations/meta/_journal.json') as { entries: unknown[] }
    writeFileSync(join(previous, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }))
    migrateDatabase(database, access, previous)
    const original = openDatabase(database)
    try {
      original.sqlite.exec(`
        INSERT INTO identities VALUES ('user', 'issuer', 'subject', 'Name');
        INSERT INTO accounts VALUES ('account', 'workspace', 'Konto', 0);
        INSERT INTO bookings VALUES ('booking', 'workspace', 'account', NULL, '2026-10-28', -1234, 'Einkauf', 3, 'user', 1);
        INSERT INTO receipts VALUES ('receipt', 'workspace', 'booking', 'key', 'Beleg.pdf', 'application/pdf', 1, 'ready');
      `)
    } finally { original.sqlite.close() }
    migrateDatabase(database, access)
    const upgraded = openDatabase(database)
    try {
      expect(upgraded.sqlite.query('SELECT id, amount_cents, version, deleting FROM bookings').values()).toEqual([['booking', -1234n, 3n, 0n]])
      expect(upgraded.sqlite.query('SELECT id, booking_id FROM receipts').values()).toEqual([['receipt', 'booking']])
    } finally { upgraded.sqlite.close() }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
