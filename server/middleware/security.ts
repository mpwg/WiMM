import { defineEventHandler, getRequestURL, setResponseHeader, setResponseStatus } from 'h3'

export default defineEventHandler(event => {
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  const path = getRequestURL(event).pathname
  setResponseHeader(event, 'referrer-policy', path.startsWith('/auth/') ? 'no-referrer' : 'same-origin')
  if (path.startsWith('/api/') || path.startsWith('/auth/')) setResponseHeader(event, 'cache-control', 'no-store')
  if (path === '/api/_auth' || path.startsWith('/api/_auth/')) {
    setResponseStatus(event, 404)
    return { error: { code: 'not_found', message: 'Nicht gefunden.', fields: {} } }
  }
})
