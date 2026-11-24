import { randomUUID } from 'node:crypto'
import { definePlugin } from 'nitro'

export default definePlugin(nitro => {
  const requests = new WeakMap<Request, { id: string, start: number }>()
  nitro.hooks.hook('request', event => {
    const id = randomUUID()
    requests.set(event.req, { id, start: performance.now() })
    const context = event.req.context ??= {}
    context.requestId = id
  })
  nitro.hooks.hook('response', (response, event) => {
    const request = requests.get(event.req)
    if (!request) return
    const path = new URL(event.req.url).pathname
    if (!/^\/(api|auth|health)(\/|$)/.test(path)) return
    const operation = path.replace(/\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?=\/|$)/gi, '/:id')
    console.info(JSON.stringify({
      requestId: request.id, operation, method: event.req.method, status: response.status,
      durationMs: Math.round(performance.now() - request.start),
    }))
  })
})
