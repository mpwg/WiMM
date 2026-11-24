import { expect, test } from 'bun:test'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { H3 } from 'nitro/h3'
import { z } from 'zod'
import { endpoint, parse, readJson } from '../server/utils/api'

const app = new H3().post('/validate', endpoint(async event => parse(z.object({ name: z.string() }), await readJson(event))))

function post(body: BodyInit, contentType = 'application/json') {
  return app.request(new Request('http://localhost/validate', { method: 'POST', body, headers: { 'content-type': contentType } }))
}

test('presents schema failures as structured field errors', async () => {
  const response = await post('{"name":42}')
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({ error: { code: 'validation_failed', fields: { name: expect.any(String) } } })
})

test('refuses oversized streamed JSON', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(65_537))
      controller.close()
    },
  })
  const response = await post(body)
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ error: { code: 'payload_too_large' } })
})

test('requires JSON for API bodies', async () => {
  const response = await post('{"name":"Bargeld"}', 'text/plain')
  expect(response.status).toBe(415)
  expect(await response.json()).toMatchObject({ error: { code: 'unsupported_media_type' } })
})

test('returns 413 before waiting for the rest of a chunked HTTP request', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch })
  const client = httpRequest(new URL('/validate', server.url), {
    method: 'POST', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', connection: 'keep-alive' },
  })
  try {
    const response = once(client, 'response')
    client.write(Buffer.alloc(80 * 1024))
    const [reply] = await response
    expect(reply.statusCode).toBe(413)
    expect(reply.headers.connection).toBe('close')
    reply.resume()
    await once(reply, 'end')
  } finally {
    client.destroy()
    await server.stop(true)
  }
}, 3000)
