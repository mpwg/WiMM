import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const path = process.env.NUXT_DATABASE_PATH!
const receipts = process.env.NUXT_RECEIPTS_PATH!
const db = new Database(path, { create: false, safeIntegers: true })
const workspace = '5ec8df94-adc0-4874-807a-98343ac9cff2'
const key = '9feb0ecc-cbe2-4d9e-b97c-1ac8be73f260'
const document = '%PDF-1.4\nWiMM Compose\n%%EOF\n'
const [command] = Bun.argv.slice(2)
try {
  if (command === 'seed') {
    mkdirSync(receipts, { recursive: true })
    writeFileSync(join(receipts, key), document)
    db.exec('PRAGMA foreign_keys = ON')
    db.transaction(() => {
      db.run('INSERT INTO identities VALUES (?, ?, ?, ?)', ['fixture', 'local', 'test', 'Compose'])
      db.run('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)', ['fixture', 'fixture', Date.now() + 86_400_000, Date.now(), '[]', 'csrf'])
      db.run('INSERT INTO accounts (id, workspace_id, name) VALUES (?, ?, ?)', ['fixture', workspace, 'Kasse'])
      db.run('INSERT INTO bookings (id, workspace_id, account_id, date, amount_cents, description, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['fixture', workspace, 'fixture', '2026-11-24', -9007199254740993n, 'Compose', 'fixture', Date.now()])
      db.run('INSERT INTO receipts (id, workspace_id, booking_id, storage_key, original_name, media_type, size, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['fixture', workspace, 'fixture', key, 'test.pdf', 'application/pdf', Buffer.byteLength(document), 'ready'])
    })()
  } else if (command === 'corrupt') {
    db.run("UPDATE __drizzle_migrations SET hash = 'invalid' WHERE rowid = 1")
  } else {
    assert.equal(db.query('SELECT count(*) FROM bookings').values()[0]?.[0], 1n)
    assert.equal(db.query('SELECT sum(amount_cents) FROM bookings').values()[0]?.[0], -9007199254740993n)
    assert.equal(readFileSync(join(receipts, key), 'utf8'), document)
    const sessionCount = command === 'restored' ? 0n : 1n
    assert.equal(db.query('SELECT count(*) FROM sessions').values()[0]?.[0], sessionCount)
  }
} finally {
  db.close()
}
