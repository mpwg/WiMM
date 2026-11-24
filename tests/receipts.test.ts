import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { openDatabase } from '../server/db/client'
import { bookings, receipts } from '../server/db/schema'
import { addReceipt, deleteBookingWithReceipts, deleteReceipt, getReceipt, listReceipts, recoverReceipts } from '../server/modules/receipts/service'
import { storageFixture } from './storage-fixture'

const pdf = Buffer.from('%PDF-1.4\nBeleg\n')
let fixture: ReturnType<typeof storageFixture>
beforeEach(() => {
  fixture = storageFixture()
  mkdirSync(fixture.config.receiptsPath)
})
afterEach(() => fixture.dispose())

test('receipt keys are private and download is scoped to its workspace', () => {
  const { connection, context, config, bookingId, otherWorkspaceId } = fixture
  const metadata = addReceipt(connection, config.receiptsPath, context, bookingId, '../../Beleg Käse.pdf', pdf)
  expect(metadata.originalName).toBe('Beleg Käse.pdf')
  expect(metadata.mediaType).toBe('application/pdf')
  expect(listReceipts(connection, context, bookingId)).toEqual([metadata])
  const files = readdirSync(config.receiptsPath)
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(getReceipt(connection, config.receiptsPath, context, metadata.id).data).toEqual(pdf)
  expect(() => getReceipt(connection, config.receiptsPath, { ...context, workspaceId: otherWorkspaceId }, metadata.id))
    .toThrow(expect.objectContaining({ statusCode: 404 }))
  expect(() => deleteReceipt(connection, config.receiptsPath, { ...context, workspaceId: otherWorkspaceId }, metadata.id))
    .toThrow(expect.objectContaining({ statusCode: 404 }))
  deleteReceipt(connection, config.receiptsPath, context, metadata.id)
  expect(listReceipts(connection, context, bookingId)).toEqual([])
  expect(readdirSync(config.receiptsPath)).toEqual([])
})

test('a user-supplied filename cannot bypass signature or size checks', () => {
  const { connection, context, config, bookingId } = fixture
  expect(() => addReceipt(connection, config.receiptsPath, context, bookingId, 'fake.pdf', Buffer.from('<html>')))
    .toThrow(expect.objectContaining({ statusCode: 415 }))
  expect(() => addReceipt(connection, config.receiptsPath, context, bookingId, 'fake.pdf', Buffer.alloc(10 * 1024 * 1024 + 1)))
    .toThrow(expect.objectContaining({ statusCode: 413 }))
  expect(readdirSync(config.receiptsPath)).toEqual([])
})

function register(status: 'pending' | 'ready' | 'deleting') {
  const { connection, context, config, bookingId } = fixture
  const id = crypto.randomUUID()
  const storageKey = crypto.randomUUID()
  connection.db.insert(receipts).values({
    id, storageKey, status, workspaceId: context.workspaceId, bookingId,
    originalName: 'Beleg.pdf', mediaType: 'application/pdf', size: pdf.byteLength,
  }).run()
  return { id, final: join(config.receiptsPath, storageKey), temporary: join(config.receiptsPath, `${storageKey}.upload`) }
}

test('recovery completes both pending upload transitions and purges incomplete or orphaned files', () => {
  const { connection, context, config, bookingId } = fixture
  const staged = register('pending')
  const renamed = register('pending')
  const incomplete = register('pending')
  const deleting = register('deleting')
  const orphan = join(config.receiptsPath, `${crypto.randomUUID()}.upload`)
  writeFileSync(staged.temporary, pdf)
  writeFileSync(renamed.final, pdf)
  writeFileSync(incomplete.temporary, pdf.subarray(0, 4))
  writeFileSync(deleting.final, pdf)
  writeFileSync(orphan, pdf)
  expect(listReceipts(connection, context, bookingId)).toEqual([])
  recoverReceipts(connection, config.receiptsPath)
  recoverReceipts(connection, config.receiptsPath)
  expect(listReceipts(connection, context, bookingId).map(row => row.id).sort()).toEqual([staged.id, renamed.id].sort())
  expect(readdirSync(config.receiptsPath)).toHaveLength(2)
  expect(readFileSync(staged.final)).toEqual(pdf)
})

test('booking deletion checks versions and recovers after a file deletion error', () => {
  const { connection, context, config, bookingId } = fixture
  const receipt = register('ready')
  mkdirSync(receipt.final)
  expect(() => deleteBookingWithReceipts(connection, config.receiptsPath, context, bookingId, 2))
    .toThrow(expect.objectContaining({ statusCode: 409 }))
  expect(connection.db.select().from(bookings).where(eq(bookings.id, bookingId)).get()?.deleting).toBe(false)
  expect(() => deleteBookingWithReceipts(connection, config.receiptsPath, context, bookingId, 1))
    .toThrow(expect.objectContaining({ statusCode: 503 }))
  expect(connection.db.select().from(bookings).where(eq(bookings.id, bookingId)).get()?.deleting).toBe(true)
  expect(listReceipts(connection, context, bookingId)).toEqual([])
  // Restore the original type to simulate the underlying filesystem fault clearing.
  rmdirSync(receipt.final)
  writeFileSync(receipt.final, pdf)
  recoverReceipts(connection, config.receiptsPath)
  expect(connection.db.select().from(bookings).where(eq(bookings.id, bookingId)).get()).toBeUndefined()
  expect(connection.db.select().from(receipts).where(eq(receipts.id, receipt.id)).get()).toBeUndefined()
  expect(existsSync(receipt.final)).toBe(false)
})

test('storage never reads through receipt symlinks', () => {
  const { connection, context, config, dir } = fixture
  const receipt = register('ready')
  const outside = join(dir, 'outside.pdf')
  writeFileSync(outside, pdf)
  symlinkSync(outside, receipt.final)
  expect(() => getReceipt(connection, config.receiptsPath, context, receipt.id)).toThrow(expect.objectContaining({ statusCode: 503 }))
  expect(() => recoverReceipts(connection, config.receiptsPath)).toThrow()
  expect(readFileSync(outside)).toEqual(pdf)
})

test.each(['pending', 'renamed', 'deleting'])('receipt recovery survives a stopped process at %s', async phase => {
  const { connection, context, config, bookingId } = fixture
  if (phase === 'deleting') addReceipt(connection, config.receiptsPath, context, bookingId, 'Beleg.pdf', pdf)
  connection.sqlite.close(true)
  const child = Bun.spawn([
    process.execPath, new URL('./support/receipt-crash.ts', import.meta.url).pathname,
    phase, config.databasePath, config.receiptsPath, context.workspaceId, context.userId, bookingId,
  ], { stdout: 'ignore', stderr: 'pipe' })
  const exit = await child.exited
  const stderr = await new Response(child.stderr).text()
  expect({ exit, stderr }).toEqual({ exit: 137, stderr: '' })
  const restarted = openDatabase(config.databasePath)
  try {
    expect(listReceipts(restarted, context, bookingId)).toEqual([])
    recoverReceipts(restarted, config.receiptsPath)
    if (phase === 'deleting') {
      expect(restarted.db.select().from(bookings).get()).toBeUndefined()
      expect(readdirSync(config.receiptsPath)).toEqual([])
    } else {
      const [restored] = listReceipts(restarted, context, bookingId)
      expect(restored).toBeDefined()
      expect(getReceipt(restarted, config.receiptsPath, context, restored!.id).data).toEqual(pdf)
    }
  } finally { restarted.sqlite.close(true) }
})
