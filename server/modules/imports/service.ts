import { createHash } from 'node:crypto'
import { and, eq, inArray, lte, ne } from 'drizzle-orm'
import type { ImportMapping, ImportPreview, ImportRow, ImportRowError } from '../../../shared/schemas/imports'
import type { Connection } from '../../db/client'
import { accounts, bookings, categories, imports } from '../../db/schema'
import { ApiError } from '../http-error'
import type { AccessContext } from '../identity/access'
import { MAX_CSV_BYTES, normalizeImport } from './normalize'

const previewLifetime = 24 * 60 * 60 * 1000
type ImportRecord = typeof imports.$inferSelect
type ImportDb = Connection['db'] | Parameters<Parameters<Connection['db']['transaction']>[0]>[0]

function scopedImport(context: AccessContext, id: string) {
  return and(eq(imports.id, id), eq(imports.workspaceId, context.workspaceId), eq(imports.createdBy, context.userId))
}

function requiredImport(db: ImportDb, context: AccessContext, id: string, now: number) {
  const record = db.select().from(imports).where(scopedImport(context, id)).get()
  if (!record) throw new ApiError(404, 'not_found', 'Der Import wurde nicht gefunden.')
  if (record.status === 'preview' && record.expiresAt <= now) throw new ApiError(410, 'import_expired', 'Diese Importvorschau ist abgelaufen.')
  return record
}

function requireActiveAccount(db: ImportDb, workspaceId: string, accountId: string) {
  const row = db.select({ archived: accounts.archived }).from(accounts).where(and(
    eq(accounts.workspaceId, workspaceId), eq(accounts.id, accountId),
  )).get()
  if (!row) throw new ApiError(404, 'not_found', 'Das Zielkonto wurde nicht gefunden.')
  if (row.archived) throw new ApiError(422, 'validation_failed', 'Das Zielkonto ist archiviert.', { accountId: 'Wähle ein aktives Konto.' })
}

function activeCategories(db: ImportDb, workspaceId: string) {
  return db.select({ id: categories.id, name: categories.name }).from(categories).where(and(
    eq(categories.workspaceId, workspaceId), eq(categories.archived, false),
  )).all()
}

function toPreview(db: ImportDb, record: ImportRecord): ImportPreview {
  const duplicate = db.select({ id: imports.id }).from(imports).where(and(
    eq(imports.workspaceId, record.workspaceId), eq(imports.accountId, record.accountId), eq(imports.fileHash, record.fileHash),
    eq(imports.status, 'confirmed'), ne(imports.id, record.id),
  )).limit(1).get() !== undefined
  return {
    id: record.id,
    accountId: record.accountId,
    status: record.status,
    expiresAt: record.expiresAt,
    rows: record.preview as ImportRow[],
    errors: record.errors as ImportRowError[],
    duplicate,
    result: record.result,
  }
}

export function previewImport(connection: Connection, context: AccessContext, data: Uint8Array, mapping: ImportMapping, now = Date.now()): ImportPreview {
  const { db } = connection
  if (data.byteLength > MAX_CSV_BYTES) throw new ApiError(413, 'payload_too_large', 'Eine CSV-Datei darf höchstens 5 MiB groß sein.')
  requireActiveAccount(db, context.workspaceId, mapping.accountId)
  const { rows, errors } = normalizeImport(data, mapping, activeCategories(db, context.workspaceId))
  const fileHash = createHash('sha256').update(data).digest('hex')
  return db.transaction(tx => {
    const oldPreviews = tx.select({ id: imports.id }).from(imports).where(and(eq(imports.status, 'preview'), lte(imports.expiresAt, now)))
      .orderBy(imports.expiresAt).limit(100)
    tx.delete(imports).where(inArray(imports.id, oldPreviews)).run()
    const record = tx.insert(imports).values({
      id: crypto.randomUUID(), workspaceId: context.workspaceId, createdBy: context.userId, accountId: mapping.accountId,
      fileHash, preview: rows, errors, expiresAt: now + previewLifetime,
    }).returning().get()!
    return toPreview(tx, record)
  }, { behavior: 'immediate' })
}

export function getImport(connection: Connection, context: AccessContext, id: string, now = Date.now()) {
  return toPreview(connection.db, requiredImport(connection.db, context, id, now))
}

export function confirmImport(connection: Connection, context: AccessContext, id: string, now = Date.now()) {
  return connection.db.transaction(tx => {
    const record = requiredImport(tx, context, id, now)
    if (record.status === 'confirmed') return toPreview(tx, record)
    if (record.errors.length || !record.preview.length) {
      throw new ApiError(422, 'validation_failed', 'Behebe zuerst die Fehler in der Importvorschau.')
    }
    requireActiveAccount(tx, context.workspaceId, record.accountId)
    const activeIds = new Set(activeCategories(tx, context.workspaceId).map(category => category.id))
    const result: string[] = []
    for (const row of record.preview as ImportRow[]) {
      if (row.categoryId !== null && !activeIds.has(row.categoryId)) {
        throw new ApiError(422, 'validation_failed', 'Eine zugeordnete Kategorie ist nicht mehr aktiv.')
      }
      const bookingId = crypto.randomUUID()
      tx.insert(bookings).values({
        id: bookingId, workspaceId: context.workspaceId, accountId: record.accountId, categoryId: row.categoryId,
        date: row.date, amountCents: BigInt(row.amountCents), description: row.description, createdBy: context.userId, updatedAt: now,
      }).run()
      result.push(bookingId)
    }
    tx.update(imports).set({ status: 'confirmed', result }).where(scopedImport(context, id)).run()
    return toPreview(tx, { ...record, status: 'confirmed', result })
  }, { behavior: 'immediate' })
}
