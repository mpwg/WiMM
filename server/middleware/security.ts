import { defineMiddleware } from 'nitro/h3'

export default defineMiddleware(event => {
  const headers = event.res.headers
  headers.set('x-content-type-options', 'nosniff')
  if (event.context.requestId) headers.set('x-request-id', event.context.requestId)
  const path = event.url.pathname
  headers.set('referrer-policy', path.startsWith('/auth/') ? 'no-referrer' : 'same-origin')
  if (path.startsWith('/api/') || path.startsWith('/auth/')) headers.set('cache-control', 'no-store')
  if (path === '/api/_auth' || path.startsWith('/api/_auth/')) {
    event.res.status = 404
    return { error: { code: 'not_found', message: 'Nicht gefunden.', fields: {} } }
  }
})
