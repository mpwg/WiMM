import type {} from '../../types'
import { defineHandler } from 'nitro/h3'

export default defineHandler(event => {
  try {
    event.context.storage.sqlite.query('SELECT 1 FROM __drizzle_migrations LIMIT 1').get()
    return { status: 'ok' }
  } catch {
    event.res.status = 503
    return { status: 'unavailable' }
  }
})
