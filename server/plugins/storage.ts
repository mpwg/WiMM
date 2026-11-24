import { loadStorageConfig } from '../config'
import { openDatabase } from '../db/client'
import { verifyDatabase, verifyWorkspaces } from '../db/lifecycle'
import { assertRestoreComplete } from '../modules/backup/restore-state'
import { recoverReceipts } from '../modules/receipts/service'

export default defineNitroPlugin(nitro => {
  const config = loadStorageConfig()
  assertRestoreComplete(config.databasePath)
  const connection = openDatabase(config.databasePath)
  try {
    verifyDatabase(connection)
    verifyWorkspaces(connection, config.access)
    recoverReceipts(connection, config.receiptsPath)
  } catch (error) { connection.sqlite.close(); throw error }
  nitro.hooks.hook('request', event => {
    event.context.storage = connection
    event.context.receiptsPath = config.receiptsPath
    event.context.accessConfig = config.access
  })
  nitro.hooks.hook('close', () => { connection.sqlite.close() })
})
