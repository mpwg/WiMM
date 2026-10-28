export default defineEventHandler(event => {
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'referrer-policy', 'same-origin')
  const path = getRequestURL(event).pathname
  if (path.startsWith('/api/') || path.startsWith('/auth/')) setResponseHeader(event, 'cache-control', 'no-store')
  // The module's cookie-only session endpoints must never bypass the future SQLite adapter.
  if (path.startsWith('/api/_auth/')) {
    setResponseStatus(event, 404)
    return { error: { code: 'not_found', message: 'Nicht gefunden.', fields: {} } }
  }
})
