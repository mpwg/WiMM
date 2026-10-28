import { sql } from 'drizzle-orm'
import { sqliteTable, text, customType, unique, foreignKey, index, check } from 'drizzle-orm/sqlite-core'

// better-sqlite3 returns every SQL integer as bigint to avoid losing money precision.
// Narrow non-monetary integers explicitly at the schema boundary.
const integer = customType<{ data: number, driverData: number | bigint }>({ dataType: () => 'integer', fromDriver: value => Number(value) })
const boolean = customType<{ data: boolean, driverData: number | bigint }>({ dataType: () => 'integer', toDriver: value => value ? 1 : 0, fromDriver: value => value === 1 || value === 1n })
const cents = customType<{ data: bigint, driverData: bigint }>({ dataType: () => 'integer', fromDriver: value => BigInt(value), toDriver: value => value })

export const identities = sqliteTable('identities', {
  id: text().primaryKey(), issuer: text().notNull(), subject: text().notNull(), displayName: text('display_name').notNull(),
}, t => [unique().on(t.issuer, t.subject)])
export const workspaces = sqliteTable('workspaces', {
  id: text().primaryKey(), name: text().notNull(), currency: text().notNull().default('EUR'),
}, t => [check('currency_eur', sql`${t.currency} = 'EUR'`)])
export const sessions = sqliteTable('sessions', {
  id: text().primaryKey(), userId: text('user_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(), groupsCheckedAt: integer('groups_checked_at').notNull(),
  groups: text({ mode: 'json' }).$type<string[]>().notNull(), csrfToken: text('csrf_token').notNull(),
}, t => [index('sessions_user').on(t.userId)])
export const accounts = sqliteTable('accounts', {
  id: text().primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text().notNull(), archived: boolean().notNull().default(false),
}, t => [unique().on(t.workspaceId, t.id), check('account_archived', sql`${t.archived} IN (0, 1)`)])
export const categories = sqliteTable('categories', {
  id: text().primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text().notNull(), archived: boolean().notNull().default(false),
}, t => [unique().on(t.workspaceId, t.id), check('category_archived', sql`${t.archived} IN (0, 1)`)])
export const bookings = sqliteTable('bookings', {
  id: text().primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  accountId: text('account_id').notNull(), categoryId: text('category_id'), date: text().notNull(),
  amountCents: cents('amount_cents').notNull(), description: text().notNull(),
  version: integer().notNull().default(1), createdBy: text('created_by').notNull().references(() => identities.id),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  unique().on(t.workspaceId, t.id),
  foreignKey({ columns: [t.workspaceId, t.accountId], foreignColumns: [accounts.workspaceId, accounts.id] }),
  foreignKey({ columns: [t.workspaceId, t.categoryId], foreignColumns: [categories.workspaceId, categories.id] }),
  index('bookings_workspace_date').on(t.workspaceId, t.date, t.id),
  check('nonzero_amount', sql`typeof(${t.amountCents}) = 'integer' AND ${t.amountCents} <> 0`),
  check('positive_version', sql`${t.version} >= 1`),
])
export const imports = sqliteTable('imports', {
  id: text().primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdBy: text('created_by').notNull().references(() => identities.id), accountId: text('account_id').notNull(),
  fileHash: text('file_hash').notNull(), preview: text({ mode: 'json' }).$type<unknown[]>().notNull(),
  errors: text({ mode: 'json' }).$type<unknown[]>().notNull(), result: text({ mode: 'json' }).$type<string[]>(),
  status: text({ enum: ['preview', 'confirmed'] }).notNull().default('preview'), expiresAt: integer('expires_at').notNull(),
}, t => [
  foreignKey({ columns: [t.workspaceId, t.accountId], foreignColumns: [accounts.workspaceId, accounts.id] }),
  index('imports_workspace_hash').on(t.workspaceId, t.accountId, t.fileHash),
  check('import_status', sql`${t.status} IN ('preview', 'confirmed')`),
])
export const receipts = sqliteTable('receipts', {
  id: text().primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  bookingId: text('booking_id').notNull(), storageKey: text('storage_key').notNull().unique(),
  originalName: text('original_name').notNull(), mediaType: text('media_type').notNull(), size: integer().notNull(),
  status: text({ enum: ['pending', 'ready', 'deleting'] }).notNull(),
}, t => [
  foreignKey({ columns: [t.workspaceId, t.bookingId], foreignColumns: [bookings.workspaceId, bookings.id] }),
  check('receipt_status', sql`${t.status} IN ('pending', 'ready', 'deleting')`),
  check('receipt_size', sql`${t.size} > 0 AND ${t.size} <= 10485760`),
  check('receipt_media_type', sql`${t.mediaType} IN ('application/pdf', 'image/jpeg', 'image/png')`),
])
