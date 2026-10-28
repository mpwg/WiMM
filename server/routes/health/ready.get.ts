export default defineEventHandler(event => {
  try {
    event.context.storage.sqlite.prepare('SELECT 1 FROM __drizzle_migrations LIMIT 1').get()
    return { status: 'ok' }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'unavailable' }
  }
})
