import { linkSync, lstatSync, readFileSync, renameSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { syncDirectory, writePrivateFile } from '../receipts/files'

export type StoragePaths = { databasePath: string, receiptsPath: string }
const restoreJournal = z.object({
  id: z.uuid(),
  existing: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
}).strict()

const markerPath = (database: string) => `${database}.restore-in-progress`
const fileExists = (path: string) => lstatSync(path, { throwIfNoEntry: false }) !== undefined

export function assertRestoreComplete(databasePath: string) {
  if (fileExists(markerPath(databasePath))) {
    throw new Error('Eine Wiederherstellung wurde unterbrochen. Wiederhole den Restore-Befehl bei gestoppter Anwendung.')
  }
}

export function restoreStage(paths: StoragePaths, id: string) {
  const databaseDir = join(dirname(paths.databasePath), `.wimm-restore-db-${id}`)
  const receiptsDir = join(dirname(paths.receiptsPath), `.wimm-restore-files-${id}`)
  return {
    databaseDir, receiptsDir,
    databaseFile: join(databaseDir, 'wimm.sqlite'),
    receiptFolder: join(receiptsDir, 'receipts'),
  }
}

function replacements(paths: StoragePaths, id: string) {
  const { databaseFile, receiptFolder } = restoreStage(paths, id)
  const originals = [paths.databasePath, `${paths.databasePath}-wal`, `${paths.databasePath}-shm`, paths.receiptsPath] as const
  const replacements = [databaseFile, null, null, receiptFolder] as const
  return originals.map((path, index) => ({ path, saved: `${path}.wimm-restore-${id}.old`, replacement: replacements[index] }))
}

function syncParents(paths: StoragePaths) {
  const parents = new Set([dirname(paths.databasePath), dirname(paths.receiptsPath)])
  for (const parent of parents) syncDirectory(parent)
}

export function rollbackInterruptedRestore(paths: StoragePaths) {
  const marker = markerPath(paths.databasePath)
  const journal = lstatSync(marker, { throwIfNoEntry: false })
  if (!journal) return
  if (!journal.isFile()) throw new Error('Das Wiederherstellungsprotokoll ist ungültig.')
  const { id, existing } = restoreJournal.parse(JSON.parse(readFileSync(marker, 'utf8')))
  for (const [index, { path, saved }] of replacements(paths, id).entries()) {
    if (fileExists(saved)) {
      rmSync(path, { recursive: true, force: true })
      renameSync(saved, path)
    } else if (!existing[index]) {
      rmSync(path, { recursive: true, force: true })
    } else if (!fileExists(path)) {
      throw new Error('Die ursprünglichen Daten der unterbrochenen Wiederherstellung fehlen.')
    }
  }
  syncParents(paths)
  unlinkSync(marker)
  syncDirectory(dirname(marker))
  const stage = restoreStage(paths, id)
  for (const directory of [stage.databaseDir, stage.receiptsDir]) rmSync(directory, { recursive: true, force: true })
}

export function publishRestore(paths: StoragePaths, id: string) {
  const marker = markerPath(paths.databasePath)
  const entries = replacements(paths, id)
  const existing = entries.map(entry => fileExists(entry.path))
  const preparedMarker = join(restoreStage(paths, id).databaseDir, 'journal.json')
  writePrivateFile(preparedMarker, JSON.stringify({ id, existing }))
  linkSync(preparedMarker, marker)
  syncDirectory(dirname(marker))
  try {
    for (const [index, { path, saved }] of entries.entries()) {
      if (existing[index]) renameSync(path, saved)
    }
    syncParents(paths)
    for (const { path, replacement } of entries) {
      if (replacement) renameSync(replacement, path)
    }
    syncParents(paths)
  } catch (error) {
    rollbackInterruptedRestore(paths)
    throw error
  }
  unlinkSync(marker)
  syncDirectory(dirname(marker))
  for (const { saved } of entries) {
    rmSync(saved, { recursive: true, force: true })
  }
  syncParents(paths)
}
