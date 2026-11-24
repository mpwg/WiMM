import { randomUUID } from 'node:crypto'
import { getRequestURL, setResponseHeader } from 'h3'

export default defineNitroPlugin(nitro => {
  const requests = new WeakMap<object, { id: string, start: number }>()
  nitro.hooks.hook('request', event => {
    const id = randomUUID()
    requests.set(event, { id, start: performance.now() })
    setResponseHeader(event, 'x-request-id', id)
  })
  nitro.hooks.hook('afterResponse', event => {
    const request = requests.get(event)
    if (!request) return
    const path = getRequestURL(event).pathname
    if (!/^\/(api|auth|health)(\/|$)/.test(path)) return
    const operation = path.replace(/\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?=\/|$)/gi, '/:id')
    console.info(JSON.stringify({
      requestId: request.id, operation, method: event.method, status: event.node.res.statusCode,
      durationMs: Math.round(performance.now() - request.start),
    }))
  })
})
