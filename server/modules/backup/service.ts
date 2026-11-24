import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { accessConfigSchema, type AccessConfig } from '../../../shared/schemas/access'
import { version as applicationVersion } from '../../../package.json'
import { openDatabase, type Connection } from '../../db/client'
import { verifyDatabase, verifyWorkspaces } from '../../db/lifecycle'
import { bookings, receipts } from '../../db/schema'
import { detectReceiptType, isReceiptKey, MAX_RECEIPT_BYTES, readStoredReceipt, receiptPaths, syncDirectory, writePrivateFile } from '../receipts/files'
import { databaseEntry, manifestEntry, readBackupEntries, receiptEntry } from './archive'
import { assertRestoreComplete, publishRestore, restoreStage, rollbackInterruptedRestore, type StoragePaths } from './restore-state'

type BackupConfig = StoragePaths & { access: AccessConfig }
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)
const backupManifest = z.object({
  formatVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  image: z.string().nullable(),
  applicationVersion: z.string().min(1),
  access: accessConfigSchema,
  migrations: z.array(sha256).min(1),
  databaseSha256: sha256,
  receipts: z.array(z.object({
    storageKey: z.string().refine(isReceiptKey),
    sha256,
    size: z.int().positive().max(MAX_RECEIPT_BYTES),
  }).strict()),
}).strict()
type BackupManifest = z.infer<typeof backupManifest>

function storagePaths(config: StoragePaths): StoragePaths {
  const databasePath = resolve(config.databasePath)
  const receiptsPath = resolve(config.receiptsPath)
  const relation = relative(receiptsPath, databasePath)
  if (relation !== '..' && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)) {
    throw new Error('Die Datenbank darf nicht im Belegverzeichnis liegen.')
  }
  return { databasePath, receiptsPath }
}

function verifiedDatabase(path: string, access: AccessConfig) {
  const connection = openDatabase(path)
  try {
    verifyDatabase(connection)
    verifyWorkspaces(connection, access)
    const integrity = connection.sqlite.query('PRAGMA integrity_check').values()
    if (integrity.length !== 1 || integrity[0]?.[0] !== 'ok') throw new Error('Die Datenbank ist beschädigt.')
    return connection
  } catch (error) {
    connection.sqlite.close(true)
    throw error
  }
}

function schemaMigrations(connection: Connection) {
  return connection.sqlite.query<{ hash: string }, []>('SELECT hash FROM __drizzle_migrations ORDER BY created_at, rowid').all().map(row => row.hash)
}

function hash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sanitizedSnapshot(source: string, directory: string, access: AccessConfig) {
  if (!lstatSync(source, { throwIfNoEntry: false })?.isFile()) throw new Error('Die zu sichernde Datenbank fehlt.')
  const copied = join(directory, 'original.sqlite')
  const sanitized = join(directory, 'clean.sqlite')
  const original = new Database(source, { readonly: true })
  try { original.query('VACUUM INTO ?').run(copied) } finally { original.close(true) }
  const staged = verifiedDatabase(copied, access)
  try {
    staged.sqlite.exec(`
      BEGIN;
      DELETE FROM sessions;
      DELETE FROM receipts WHERE status <> 'ready' OR booking_id IN (SELECT id FROM bookings WHERE deleting = 1);
      DELETE FROM bookings WHERE deleting = 1;
      COMMIT;
    `)
    staged.sqlite.query('VACUUM INTO ?').run(sanitized)
  } finally { staged.sqlite.close(true) }
  return sanitized
}

export async function createBackup(config: BackupConfig, image = process.env.WIMM_IMAGE): Promise<Uint8Array> {
  const paths = storagePaths(config)
  assertRestoreComplete(paths.databasePath)
  const directory = mkdtempSync(join(dirname(paths.databasePath), '.wimm-backup-'))
  try {
    const snapshot = sanitizedSnapshot(paths.databasePath, directory, config.access)
    const connection = verifiedDatabase(snapshot, config.access)
    try {
      const manifest: BackupManifest = {
        formatVersion: 1,
        createdAt: new Date().toISOString(),
        image: image ?? null,
        applicationVersion,
        access: config.access,
        migrations: schemaMigrations(connection),
        databaseSha256: '',
        receipts: [],
      }
      const database = readFileSync(snapshot)
      manifest.databaseSha256 = hash(database)
      const files: Record<string, Uint8Array | string> = { [databaseEntry]: database }
      for (const row of connection.db.select().from(receipts).orderBy(receipts.storageKey).all()) {
        const file = readStoredReceipt(receiptPaths(paths.receiptsPath, row.storageKey).ready, row.size, row.mediaType)
        manifest.receipts.push({ storageKey: row.storageKey, sha256: hash(file), size: file.byteLength })
        files[receiptEntry(row.storageKey)] = file
      }
      files[manifestEntry] = JSON.stringify(manifest, null, 2) + '\n'
      return await new Bun.Archive(files).bytes()
    } finally { connection.sqlite.close(true) }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

function verifiedPayload(archive: Uint8Array) {
  const entries = readBackupEntries(archive)
  const manifestFile = entries.get(manifestEntry)
  if (!manifestFile) throw new Error('Das Archivmanifest fehlt.')
  const manifest = backupManifest.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestFile)))
  const database = entries.get(databaseEntry)
  if (!database || hash(database) !== manifest.databaseSha256) throw new Error('Die Prüfsumme der Datenbank stimmt nicht.')
  const files = new Map<string, Uint8Array>()
  for (const receipt of manifest.receipts) {
    const bytes = entries.get(receiptEntry(receipt.storageKey))
    if (!bytes || bytes.byteLength !== receipt.size || hash(bytes) !== receipt.sha256) {
      throw new Error('Die Prüfsumme eines Belegs stimmt nicht.')
    }
    if (files.has(receipt.storageKey)) throw new Error('Ein Beleg ist im Archivmanifest mehrfach enthalten.')
    files.set(receipt.storageKey, bytes)
  }
  if (entries.size !== files.size + 2) throw new Error('Das Archiv enthält nicht im Manifest aufgeführte Dateien.')
  return { manifest, database, files }
}

function validateStagedRestore(connection: Connection, payload: ReturnType<typeof verifiedPayload>, access: AccessConfig) {
  const { manifest, files } = payload
  const hashes = schemaMigrations(connection)
  if (hashes.length !== manifest.migrations.length || hashes.some((value, index) => value !== manifest.migrations[index])) {
    throw new Error('Das Datenbankschema stimmt nicht mit dem Archivmanifest überein.')
  }
  verifyWorkspaces(connection, access)
  if (connection.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.deleting, true)).get()) {
    throw new Error('Die Sicherung enthält eine unvollständige Löschung.')
  }
  const stored = connection.db.select().from(receipts).all()
  if (files.size !== stored.length) throw new Error('Datenbank und Archiv enthalten verschiedene Belege.')
  for (const receipt of stored) {
    const file = files.get(receipt.storageKey)
    if (receipt.status !== 'ready' || !file || file.byteLength !== receipt.size || detectReceiptType(file) !== receipt.mediaType) {
      throw new Error('Ein Beleg stimmt nicht mit seinem Datenbankeintrag überein.')
    }
  }
  connection.sqlite.exec('PRAGMA secure_delete = ON; DELETE FROM sessions; VACUUM;')
}

export async function restoreBackup(config: BackupConfig, archive: Uint8Array, options: { replace: boolean }): Promise<{ previousBackupPath: string | null }> {
  const paths = storagePaths(config)
  rollbackInterruptedRestore(paths)
  const payload = verifiedPayload(archive)
  const oldDatabase = lstatSync(paths.databasePath, { throwIfNoEntry: false })
  const oldReceipts = lstatSync(paths.receiptsPath, { throwIfNoEntry: false })
  if (oldDatabase && !oldDatabase.isFile() || oldReceipts && !oldReceipts.isDirectory()) {
    throw new Error('Der Wiederherstellungspfad ist kein Datenbankdatei- oder Belegverzeichnis.')
  }
  if (oldDatabase || oldReceipts && readdirSync(paths.receiptsPath).length) {
    if (!options.replace) throw new Error('Vorhandene Daten dürfen nur mit --replace ersetzt werden.')
    if (!oldDatabase) throw new Error('Vorhandene Belege können ohne Datenbank nicht vorab gesichert werden.')
  }
  mkdirSync(dirname(paths.databasePath), { recursive: true, mode: 0o700 })
  mkdirSync(dirname(paths.receiptsPath), { recursive: true, mode: 0o700 })
  const id = crypto.randomUUID()
  const stage = restoreStage(paths, id)
  mkdirSync(stage.databaseDir, { mode: 0o700 })
  try {
    mkdirSync(stage.receiptFolder, { recursive: true, mode: 0o700 })
    writePrivateFile(stage.databaseFile, payload.database)
    const connection = verifiedDatabase(stage.databaseFile, payload.manifest.access)
    try { validateStagedRestore(connection, payload, config.access) } finally { connection.sqlite.close(true) }
    for (const [key, file] of payload.files) writePrivateFile(receiptPaths(stage.receiptFolder, key).ready, file)
    syncDirectory(stage.receiptFolder)
    syncDirectory(stage.databaseDir)
    let previousBackupPath = null
    if (oldDatabase) {
      const previous = await createBackup(config)
      previousBackupPath = join(dirname(paths.databasePath), `wimm-vor-restore-${id}.tar`)
      writePrivateFile(previousBackupPath, previous)
      syncDirectory(dirname(previousBackupPath))
    }
    publishRestore(paths, id)
    return { previousBackupPath }
  } finally {
    for (const directory of [stage.databaseDir, stage.receiptsDir]) rmSync(directory, { recursive: true, force: true })
  }
}
