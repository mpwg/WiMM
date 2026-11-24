import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, lt, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Connection } from '../../db/client'
import { accounts, bookings, categories } from '../../db/schema'
import { MAX_CENTS, MIN_CENTS, bookingDateSchema, type BookingFilters, type BookingInput } from '../../../shared/schemas/finance'
import { ApiError } from '../http-error'
import type { AccessContext } from '../identity/access'

type ResourceKind = 'accounts' | 'categories'
const resources = { accounts, categories }
const cursorSchema = z.tuple([bookingDateSchema, z.uuid()])

function notFound() {
  return new ApiError(404, 'not_found', 'Nicht gefunden.')
}

export function listResources({ db }: Connection, context: AccessContext, kind: ResourceKind) {
  const table = resources[kind]
  return db.select({ id: table.id, name: table.name, archived: table.archived }).from(table)
    .where(eq(table.workspaceId, context.workspaceId)).orderBy(asc(table.archived), asc(table.name), asc(table.id)).all()
}

export function createResource({ db }: Connection, context: AccessContext, kind: ResourceKind, name: string) {
  const resource = { id: randomUUID(), name, archived: false }
  db.insert(resources[kind]).values({ ...resource, workspaceId: context.workspaceId }).run()
  return resource
}

export function updateResource({ db }: Connection, context: AccessContext, kind: ResourceKind, id: string, input: { name?: string, archived?: true }) {
  const table = resources[kind]
  const resource = db.update(table).set(input).where(and(eq(table.workspaceId, context.workspaceId), eq(table.id, id)))
    .returning({ id: table.id, name: table.name, archived: table.archived }).get()
  if (!resource) throw notFound()
  return resource
}

function bookingScope(context: AccessContext) {
  return and(eq(bookings.workspaceId, context.workspaceId), eq(bookings.deleting, false))
}

function filterBookings(context: AccessContext, filters: BookingFilters) {
  return and(bookingScope(context),
    filters.from ? gte(bookings.date, filters.from) : undefined,
    filters.to ? lte(bookings.date, filters.to) : undefined,
    filters.accountId ? eq(bookings.accountId, filters.accountId) : undefined,
    filters.categoryId ? eq(bookings.categoryId, filters.categoryId) : undefined)
}

function serializeBooking({ workspaceId: _, deleting: _deleting, amountCents, ...booking }: typeof bookings.$inferSelect) {
  return { ...booking, amountCents: amountCents.toString() }
}

function decodeCursor(cursor: string) {
  try {
    if (!/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor encoding')
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
  } catch {
    throw new ApiError(422, 'validation_failed', 'Ungültiger Seitenzeiger.', { cursor: 'Ungültiger Seitenzeiger.' })
  }
}

export function listBookings({ db }: Connection, context: AccessContext, filters: BookingFilters & { cursor?: string, limit?: number }) {
  const limit = filters.limit ?? 50
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : undefined
  const rows = db.select().from(bookings)
    .where(and(filterBookings(context, filters), cursor && or(
      lt(bookings.date, cursor[0]),
      and(eq(bookings.date, cursor[0]), lt(bookings.id, cursor[1])),
    )))
    .orderBy(desc(bookings.date), desc(bookings.id)).limit(limit + 1).all()
  const last = rows[limit - 1]
  const nextCursor = rows.length > limit && last ? Buffer.from(JSON.stringify([last.date, last.id])).toString('base64url') : null
  return { items: rows.slice(0, limit).map(serializeBooking), nextCursor }
}

export function getBooking({ db }: Connection, context: AccessContext, id: string) {
  const booking = db.select().from(bookings).where(and(bookingScope(context), eq(bookings.id, id))).get()
  if (!booking) throw notFound()
  return serializeBooking(booking)
}

function checkBookingReferences({ db }: Connection, context: AccessContext, input: BookingInput, previous?: BookingInput) {
  const references = [
    { table: accounts, id: input.accountId, field: 'accountId', existing: previous?.accountId },
    { table: categories, id: input.categoryId, field: 'categoryId', existing: previous?.categoryId },
  ]
  for (const { table, id, field, existing } of references) {
    if (id === null || id === existing) continue
    const reference = db.select({ archived: table.archived }).from(table)
      .where(and(eq(table.workspaceId, context.workspaceId), eq(table.id, id))).get()
    if (!reference) throw notFound()
    if (reference.archived) throw new ApiError(422, 'validation_failed', 'Bitte eine aktive Zuordnung wählen.', { [field]: 'Dieser Eintrag ist archiviert.' })
  }
}

export function createBooking(connection: Connection, context: AccessContext, input: BookingInput) {
  return connection.db.transaction(tx => {
    checkBookingReferences(connection, context, input)
    const row = tx.insert(bookings).values({
      ...input, id: randomUUID(), workspaceId: context.workspaceId, createdBy: context.userId,
      updatedAt: Date.now(), amountCents: BigInt(input.amountCents),
    }).returning().get()
    return serializeBooking(row)
  }, { behavior: 'immediate' })
}

export function updateBooking(connection: Connection, context: AccessContext, id: string, input: BookingInput & { version: number }) {
  const { version, ...changes } = input
  return connection.db.transaction(tx => {
    const existing = getBooking(connection, context, id)
    if (existing.version !== version) throw new ApiError(409, 'version_conflict', 'Die Buchung wurde inzwischen geändert.')
    checkBookingReferences(connection, context, changes, existing)
    const row = tx.update(bookings).set({
      ...changes, amountCents: BigInt(changes.amountCents), version: version + 1, updatedAt: Date.now(),
    }).where(and(bookingScope(context), eq(bookings.id, id), eq(bookings.version, version))).returning().get()
    if (!row) throw new ApiError(409, 'version_conflict', 'Die Buchung wurde inzwischen geändert.')
    return serializeBooking(row)
  }, { behavior: 'immediate' })
}

export function summarizeBookings({ db }: Connection, context: AccessContext, filters: BookingFilters) {
  const rows = db.select({ amountCents: bookings.amountCents }).from(bookings).where(filterBookings(context, filters)).all()
  let income = 0n
  let expense = 0n
  for (const { amountCents } of rows) {
    if (amountCents > 0n) income += amountCents
    else expense += amountCents
  }
  const balance = income + expense
  if ([income, expense, balance].some(amount => amount > MAX_CENTS || amount < MIN_CENTS)) {
    throw new ApiError(422, 'validation_failed', 'Die Summe liegt außerhalb des erlaubten Betragsbereichs.')
  }
  return { incomeCents: income.toString(), expenseCents: expense.toString(), balanceCents: balance.toString() }
}
