import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabase } from '../server/db/client'
import { bookings, receipts, sessions } from '../server/db/schema'
import { createBackup, restoreBackup } from '../server/modules/backup/service'
import { assertRestoreComplete } from '../server/modules/backup/restore-state'
import { addReceipt } from '../server/modules/receipts/service'
import { storageFixture } from './storage-fixture'

const pdf = Buffer.from('%PDF-1.4\nEin Beleg\n')
let fixture: ReturnType<typeof storageFixture>
beforeEach(() => {
  fixture = storageFixture()
  mkdirSync(fixture.config.receiptsPath)
})
afterEach(() => fixture.dispose())

function readyReceipt() {
  const { connection, context, config, bookingId } = fixture
  return addReceipt(connection, config.receiptsPath, context, bookingId, 'Beleg.pdf', pdf)
}

function restoreTarget() {
  const { dir, config } = fixture
  return { databasePath: join(dir, 'restored', 'restored.sqlite'), receiptsPath: join(dir, 'restored', 'receipts'), access: config.access }
}

test('a backup restores bookings and receipt bytes to an empty destination without session data', async () => {
  const { connection, context, config } = fixture
  const receipt = readyReceipt()
  const secret = 'non-restorable-csrf-sample-22a91d'
  connection.db.insert(sessions).values({
    id: crypto.randomUUID(), userId: context.userId, csrfToken: secret, expiresAt: 1000, groupsCheckedAt: 0, groups: ['Group'],
  }).run()
  const archive = await createBackup(config, 'registry.example.org/wimm@sha256:example')
  expect(Buffer.from(archive).includes(secret)).toBe(false)
  expect(connection.db.select().from(sessions).all()).toHaveLength(1)
  const target = restoreTarget()
  expect(await restoreBackup(target, archive, { replace: false })).toEqual({ previousBackupPath: null })
  const restored = openDatabase(target.databasePath)
  try {
    expect(restored.db.select().from(bookings).all().map(booking => booking.amountCents)).toEqual([-1234n])
    const stored = restored.db.select().from(receipts).get()!
    expect(stored.id).toBe(receipt.id)
    expect(readFileSync(join(target.receiptsPath, stored.storageKey))).toEqual(pdf)
    expect(restored.db.select().from(sessions).all()).toEqual([])
  } finally { restored.sqlite.close() }
})

test('restore requires replace and preserves the overwritten state as a separate backup', async () => {
  const { config } = fixture
  const archive = await createBackup(config)
  const target = restoreTarget()
  await restoreBackup(target, archive, { replace: false })
  const original = openDatabase(target.databasePath)
  try { original.sqlite.exec('UPDATE bookings SET amount_cents = 99') } finally { original.sqlite.close() }
  await expect(restoreBackup(target, archive, { replace: false })).rejects.toThrow('--replace')
  const result = await restoreBackup(target, archive, { replace: true })
  expect(existsSync(result.previousBackupPath ?? '')).toBe(true)
  const preserved = { ...target, databasePath: join(fixture.dir, 'previous.sqlite'), receiptsPath: join(fixture.dir, 'previous-receipts') }
  await restoreBackup(preserved, readFileSync(result.previousBackupPath!), { replace: false })
  const old = openDatabase(preserved.databasePath)
  const newDatabase = openDatabase(target.databasePath)
  try {
    expect(old.db.select().from(bookings).get()?.amountCents).toBe(99n)
    expect(newDatabase.db.select().from(bookings).get()?.amountCents).toBe(-1234n)
  } finally { old.sqlite.close(); newDatabase.sqlite.close() }
})

test('a damaged receipt digest prevents any change to existing data', async () => {
  const { config } = fixture
  readyReceipt()
  const archive = await createBackup(config)
  const target = restoreTarget()
  await restoreBackup(target, archive, { replace: false })
  const entries = Object.fromEntries(await new Bun.Archive(archive).files())
  const path = Object.keys(entries).find(entry => entry.startsWith('receipts/'))!
  const corrupt = await new Bun.Archive({ ...entries, [path]: Buffer.from('%PDF-1.4\nBad Beleg\n') }).bytes()
  await expect(restoreBackup(target, corrupt, { replace: true })).rejects.toThrow('Prüfsumme')
  expect(readFileSync(join(target.receiptsPath, readdirSync(target.receiptsPath)[0]!))).toEqual(pdf)
})

test('an archive with an unexpected path is rejected before writing data', async () => {
  const { config } = fixture
  const archive = await createBackup(config)
  const target = restoreTarget()
  const entries = Object.fromEntries(await new Bun.Archive(archive).files())
  const malformed = await new Bun.Archive({ ...entries, 'receipts/unknown': 'not a receipt' }).bytes()
  await expect(restoreBackup(target, malformed, { replace: false })).rejects.toThrow('Archivpfad')
  expect(existsSync(target.databasePath)).toBe(false)
})

test('a missing ready receipt makes the backup fail', async () => {
  const { connection, config, context, bookingId } = fixture
  connection.db.insert(receipts).values({
    id: crypto.randomUUID(), storageKey: crypto.randomUUID(), status: 'ready', workspaceId: context.workspaceId, bookingId,
    originalName: 'Beleg.pdf', mediaType: 'application/pdf', size: pdf.byteLength,
  }).run()
  await expect(createBackup(config)).rejects.toThrow('Beleg')
})

test('an interrupted two-path restore blocks startup and restores the original pair before retrying', async () => {
  const { config } = fixture
  readyReceipt()
  const target = restoreTarget()
  const archive = await createBackup(config)
  await restoreBackup(target, archive, { replace: false })

  const id = crypto.randomUUID()
  const marker = `${target.databasePath}.restore-in-progress`
  writeFileSync(marker, JSON.stringify({ id, existing: [true, false, false, true] }))
  renameSync(target.databasePath, `${target.databasePath}.wimm-restore-${id}.old`)
  renameSync(target.receiptsPath, `${target.receiptsPath}.wimm-restore-${id}.old`)
  writeFileSync(target.databasePath, 'partial replacement')
  expect(() => assertRestoreComplete(target.databasePath)).toThrow('unterbrochen')
  await expect(restoreBackup(target, new Uint8Array(), { replace: true })).rejects.toThrow('TAR-Archiv')
  expect(() => assertRestoreComplete(target.databasePath)).not.toThrow()
  const restored = openDatabase(target.databasePath)
  try {
    const stored = restored.db.select().from(receipts).get()!
    expect(restored.db.select().from(bookings).get()?.amountCents).toBe(-1234n)
    expect(readFileSync(join(target.receiptsPath, stored.storageKey))).toEqual(pdf)
  } finally { restored.sqlite.close(true) }
})
