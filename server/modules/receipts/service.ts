import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, ne } from 'drizzle-orm'
import type { ReceiptMetadata } from '../../../shared/schemas/receipts'
import type { Connection } from '../../db/client'
import { bookings, receipts } from '../../db/schema'
import { ApiError } from '../http-error'
import type { AccessContext } from '../identity/access'
import { detectReceiptType, isReceiptKey, isStoredReceipt, MAX_RECEIPT_BYTES, readStoredReceipt, receiptPaths, syncDirectory, writePrivateFile } from './files'

type ReceiptRecord = typeof receipts.$inferSelect
const selectMetadata = {
  id: receipts.id, bookingId: receipts.bookingId, originalName: receipts.originalName, mediaType: receipts.mediaType, size: receipts.size,
}

function bookingScope(workspaceId: string, bookingId: string) {
  return and(eq(bookings.workspaceId, workspaceId), eq(bookings.id, bookingId))
}

function receiptScope(workspaceId: string, id: string) {
  return and(eq(receipts.workspaceId, workspaceId), eq(receipts.id, id))
}

function receiptsForBooking(workspaceId: string, bookingId: string) {
  return and(eq(receipts.workspaceId, workspaceId), eq(receipts.bookingId, bookingId))
}

function displayName(filename: string) {
  const name = filename.split(/[\\/]/).at(-1)?.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 255).toWellFormed()
  return name || 'Beleg'
}

function removeFile(path: string) {
  try { unlinkSync(path) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
}

function deleteReceiptFiles(root: string, key: string) {
  const { ready, pending } = receiptPaths(root, key)
  removeFile(ready)
  removeFile(pending)
}

function fileOperation<T>(action: () => T) {
  try {
    return action()
  } catch {
    throw new ApiError(503, 'storage_unavailable', 'Der Belegspeicher ist derzeit nicht verfügbar.')
  }
}

export function listReceipts(connection: Connection, context: AccessContext, bookingId: string): ReceiptMetadata[] {
  return connection.db.select(selectMetadata).from(receipts).where(and(
    receiptsForBooking(context.workspaceId, bookingId), eq(receipts.status, 'ready'),
  )).orderBy(receipts.id).all() as ReceiptMetadata[]
}

export function addReceipt(connection: Connection, root: string, context: AccessContext, bookingId: string, filename: string, data: Uint8Array): ReceiptMetadata {
  if (data.byteLength > MAX_RECEIPT_BYTES) throw new ApiError(413, 'payload_too_large', 'Ein Beleg darf höchstens 10 MiB groß sein.')
  const mediaType = detectReceiptType(data)
  if (!mediaType) throw new ApiError(415, 'unsupported_media_type', 'Als Beleg sind PDF-, JPEG- und PNG-Dateien zulässig.')
  const { db } = connection
  const booking = db.select({ id: bookings.id }).from(bookings).where(and(
    bookingScope(context.workspaceId, bookingId), eq(bookings.deleting, false),
  )).get()
  if (!booking) throw new ApiError(404, 'not_found', 'Die Buchung wurde nicht gefunden.')
  const metadata = { id: crypto.randomUUID(), bookingId, originalName: displayName(filename), mediaType, size: data.byteLength }
  const storageKey = crypto.randomUUID()
  const { ready, pending } = receiptPaths(root, storageKey)
  fileOperation(() => {
    writePrivateFile(pending, data)
    syncDirectory(root)
  })
  try {
    db.insert(receipts).values({ ...metadata, storageKey, workspaceId: context.workspaceId, status: 'pending' }).run()
  } catch (error) {
    try { removeFile(pending) } catch { /* Startup recovery retries orphan cleanup. */ }
    throw error
  }
  fileOperation(() => {
    renameSync(pending, ready)
    syncDirectory(root)
  })
  db.update(receipts).set({ status: 'ready' }).where(receiptScope(context.workspaceId, metadata.id)).run()
  return metadata
}

export function getReceipt(connection: Connection, root: string, context: AccessContext, id: string) {
  const found = connection.db.select({ ...selectMetadata, storageKey: receipts.storageKey }).from(receipts).where(and(
    receiptScope(context.workspaceId, id), eq(receipts.status, 'ready'),
  )).get()
  if (!found) throw new ApiError(404, 'not_found', 'Der Beleg wurde nicht gefunden.')
  const { storageKey, ...metadata } = found
  const data = fileOperation(() => readStoredReceipt(receiptPaths(root, storageKey).ready, metadata.size, metadata.mediaType))
  return { metadata: metadata as ReceiptMetadata, data }
}

export function deleteReceipt(connection: Connection, root: string, context: AccessContext, id: string) {
  const { db } = connection
  const scope = receiptScope(context.workspaceId, id)
  const receipt = db.update(receipts).set({ status: 'deleting' }).where(and(
    scope, ne(receipts.status, 'pending'),
  )).returning({ storageKey: receipts.storageKey }).get()
  if (!receipt) throw new ApiError(404, 'not_found', 'Der Beleg wurde nicht gefunden.')
  fileOperation(() => {
    deleteReceiptFiles(root, receipt.storageKey)
    syncDirectory(root)
  })
  db.delete(receipts).where(scope).run()
}

function finalizeBookingDeletion(connection: Connection, root: string, workspaceId: string, bookingId: string) {
  const { db } = connection
  const related = receiptsForBooking(workspaceId, bookingId)
  const files = db.select({ storageKey: receipts.storageKey }).from(receipts).where(related).all()
  if (files.length) {
    fileOperation(() => {
      for (const file of files) deleteReceiptFiles(root, file.storageKey)
      syncDirectory(root)
    })
  }
  db.transaction(tx => {
    tx.delete(receipts).where(related).run()
    tx.delete(bookings).where(and(bookingScope(workspaceId, bookingId), eq(bookings.deleting, true))).run()
  })
}

export function deleteBookingWithReceipts(connection: Connection, root: string, context: AccessContext, bookingId: string, version: number) {
  const { workspaceId } = context
  connection.db.transaction(tx => {
    const scope = bookingScope(workspaceId, bookingId)
    const booking = tx.select({ version: bookings.version, deleting: bookings.deleting }).from(bookings).where(scope).get()
    if (!booking) throw new ApiError(404, 'not_found', 'Die Buchung wurde nicht gefunden.')
    if (booking.version !== version) throw new ApiError(409, 'version_conflict', 'Die Buchung wurde inzwischen geändert.')
    if (!booking.deleting) {
      tx.update(bookings).set({ deleting: true }).where(and(scope, eq(bookings.version, version))).run()
      tx.update(receipts).set({ status: 'deleting' }).where(receiptsForBooking(workspaceId, bookingId)).run()
    }
  }, { behavior: 'immediate' })
  finalizeBookingDeletion(connection, root, workspaceId, bookingId)
}

function recoverReceipt(connection: Connection, root: string, receipt: ReceiptRecord) {
  const scope = receiptScope(receipt.workspaceId, receipt.id)
  const { ready, pending } = receiptPaths(root, receipt.storageKey)
  if (receipt.status !== 'deleting') {
    const present = isStoredReceipt(ready, receipt.size, receipt.mediaType)
    if (receipt.status === 'ready') {
      if (!present) throw new Error('Ein fertiger Beleg fehlt oder ist beschädigt.')
      return
    }
    if (present || isStoredReceipt(pending, receipt.size, receipt.mediaType)) {
      if (present) removeFile(pending)
      else renameSync(pending, ready)
      syncDirectory(root)
      connection.db.update(receipts).set({ status: 'ready' }).where(scope).run()
      return
    }
  }
  deleteReceiptFiles(root, receipt.storageKey)
  syncDirectory(root)
  connection.db.delete(receipts).where(scope).run()
}

export function recoverReceipts(connection: Connection, root: string) {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const { db } = connection
  const deleting = db.select({ id: bookings.id, workspaceId: bookings.workspaceId }).from(bookings).where(eq(bookings.deleting, true)).all()
  for (const booking of deleting) finalizeBookingDeletion(connection, root, booking.workspaceId, booking.id)
  const stored = db.select().from(receipts).all()
  for (const receipt of stored) recoverReceipt(connection, root, receipt)
  const referenced = new Set(db.select({ key: receipts.storageKey }).from(receipts).all().map(row => row.key))
  for (const name of readdirSync(root)) {
    if ((isReceiptKey(name) && !referenced.has(name)) || (name.endsWith('.upload') && isReceiptKey(name.slice(0, -7)))) {
      removeFile(join(root, name))
    }
  }
  syncDirectory(root)
}
