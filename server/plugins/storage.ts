import { definePlugin } from 'nitro'
import { loadStorageConfig } from '../config'
import { openDatabase } from '../db/client'
import { verifyDatabase, verifyWorkspaces } from '../db/lifecycle'
import { assertRestoreComplete } from '../modules/backup/restore-state'
import { recoverReceipts } from '../modules/receipts/service'

export default definePlugin(nitro => {
  const config = loadStorageConfig()
  assertRestoreComplete(config.databasePath)
  const connection = openDatabase(config.databasePath)
  try {
    verifyDatabase(connection)
    verifyWorkspaces(connection, config.access)
    recoverReceipts(connection, config.receiptsPath)
  } catch (error) { connection.sqlite.close(); throw error }
  nitro.hooks.hook('request', event => {
    Object.assign(event.req.context ??= {}, {
      storage: connection, receiptsPath: config.receiptsPath, accessConfig: config.access,
    })
  })
  nitro.hooks.hook('close', () => { connection.sqlite.close() })
})
