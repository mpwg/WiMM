import { mock } from 'bun:test'
import * as fs from 'node:fs'
import type { AccessContext } from '../../server/modules/identity/access'

const [phase, databasePath, receiptsPath, workspaceId, userId, bookingId] = process.argv.slice(2)
if (!phase || !databasePath || !receiptsPath || !workspaceId || !userId || !bookingId) throw new Error('Testargumente fehlen.')

const { renameSync, unlinkSync } = fs
function stop() {
  process.kill(process.pid, 'SIGKILL')
  throw new Error('Der Testprozess wurde nicht beendet.')
}
mock.module('node:fs', () => ({
  ...fs,
  renameSync(from: string, to: string) {
    if (phase === 'pending' && from.endsWith('.upload')) stop()
    renameSync(from, to)
    if (phase === 'renamed' && from.endsWith('.upload')) stop()
  },
  unlinkSync(path: string) {
    if (phase === 'deleting') stop()
    unlinkSync(path)
  },
}))

const { openDatabase } = await import('../../server/db/client')
const { addReceipt, deleteBookingWithReceipts } = await import('../../server/modules/receipts/service')
const connection = openDatabase(databasePath)
const context: AccessContext = { workspaceId, userId, role: 'editor' }
if (phase === 'deleting') deleteBookingWithReceipts(connection, receiptsPath, context, bookingId, 1)
else addReceipt(connection, receiptsPath, context, bookingId, 'Beleg.pdf', Buffer.from('%PDF-1.4\nBeleg\n'))
throw new Error('Der erwartete Dateizugriff wurde nicht erreicht.')
