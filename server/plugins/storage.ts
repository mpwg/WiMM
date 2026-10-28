import { mkdirSync } from 'node:fs'
import { loadStorageConfig } from '../config'
import { openDatabase } from '../db/client'
import { verifyDatabase, verifyWorkspaces } from '../db/lifecycle'

export default defineNitroPlugin(nitro => {
  const config = loadStorageConfig()
  const connection = openDatabase(config.databasePath)
  try {
    verifyDatabase(connection)
    verifyWorkspaces(connection, config.access)
    mkdirSync(config.receiptsPath, { recursive: true })
    // Receipt writes stay disabled until the recovery protocol is implemented.
  } catch (error) { connection.sqlite.close(); throw error }
  nitro.hooks.hook('request', event => {
    event.context.storage = connection
    event.context.accessConfig = config.access
  })
  nitro.hooks.hook('close', () => { connection.sqlite.close() })
})
