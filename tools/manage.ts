import { mkdirSync } from 'node:fs'
import { loadStorageConfig } from '../server/config'
import { openDatabase } from '../server/db/client'
import { migrateDatabase, verifyDatabase, verifyWorkspaces } from '../server/db/lifecycle'
import { createBackup, restoreBackup } from '../server/modules/backup/service'
import { assertRestoreComplete } from '../server/modules/backup/restore-state'

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'help' || !command) {
    console.log('WiMM: migrate | verify | revoke-sessions <user-id> | backup | restore --stdin [--replace] | healthcheck | help')
    return
  }
  if (command === 'healthcheck') {
    const port = process.env.NITRO_PORT ?? '3000'
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error('Application is not ready')
    return
  }
  if (!['migrate', 'verify', 'revoke-sessions', 'backup', 'restore'].includes(command)) {
    throw new Error('Unbekannter Befehl. Verwende help.')
  }
  const config = loadStorageConfig()
  if (command === 'restore') {
    if (!args.includes('--stdin') || args.length !== new Set(args).size || args.some(arg => arg !== '--stdin' && arg !== '--replace')) {
      throw new Error('Verwendung: restore --stdin [--replace]')
    }
    const archive = new Uint8Array(await Bun.stdin.arrayBuffer())
    const result = await restoreBackup(config, archive, { replace: args.includes('--replace') })
    console.error('Sicherung wurde wiederhergestellt.')
    if (result.previousBackupPath) console.error('Sicherung des vorherigen Datenstands:', result.previousBackupPath)
    return
  }
  assertRestoreComplete(config.databasePath)
  if (command === 'backup') {
    if (args.length) throw new Error('Verwendung: backup')
    const archive = await createBackup(config, process.env.WIMM_IMAGE)
    if (await Bun.write(Bun.stdout, archive) !== archive.byteLength) throw new Error('Sicherung konnte nicht vollständig geschrieben werden.')
    return
  }
  if (command === 'migrate') {
    migrateDatabase(config.databasePath, config.access)
    mkdirSync(config.receiptsPath, { recursive: true })
    console.error('Migrations and workspace configuration applied.')
    return
  }
  const connection = openDatabase(config.databasePath)
  try {
    verifyDatabase(connection)
    verifyWorkspaces(connection, config.access)
    if (command === 'revoke-sessions') {
      const [argument] = args
      if (!argument || args.length !== 1) throw new Error('Verwendung: revoke-sessions <user-id>')
      const result = connection.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(argument)
      console.error(`Revoked ${result.changes} sessions.`)
    } else console.error('Database verified.')
  } finally { connection.sqlite.close() }
}
main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler.'
  console.error('Verwaltungsbefehl fehlgeschlagen.', message)
  process.exitCode = 1
})
