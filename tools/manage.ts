import { mkdirSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
try { loadEnvFile() } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
import { loadStorageConfig } from '../server/config'
import { openDatabase } from '../server/db/client'
import { migrateDatabase, verifyDatabase, verifyWorkspaces } from '../server/db/lifecycle'

async function main() {
  const [command, argument] = process.argv.slice(2)
  if (command === 'help' || !command) {
    console.log('WiMM: migrate | verify | revoke-sessions <user-id> | healthcheck | help')
    return
  }
  if (command === 'healthcheck') {
    const port = process.env.NITRO_PORT ?? '3000'
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error('Application is not ready')
    return
  }
  if (!['migrate', 'verify', 'revoke-sessions'].includes(command)) throw new Error('Unknown command; run help')
  const config = loadStorageConfig()
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
      if (!argument) throw new Error('A user ID is required')
      const result = connection.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(argument)
      console.error(`Revoked ${result.changes} sessions.`)
    } else console.error('Database verified.')
  } finally { connection.sqlite.close() }
}
main().catch(() => { console.error('Management command failed. Check configuration, migrations and storage permissions.'); process.exitCode = 1 })
