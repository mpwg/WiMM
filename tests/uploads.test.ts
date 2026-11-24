import { expect, test } from 'bun:test'
import { createApp, toWebHandler } from 'h3'
import { endpoint } from '../server/utils/api'
import { readUpload } from '../server/utils/uploads'

function handler(maximum: number) {
  const app = createApp()
  app.use(endpoint(async event => {
    const { file, fields } = await readUpload(event, maximum, ['mapping'])
    return { filename: file.name, size: file.size, mapping: fields.get('mapping') }
  }))
  return toWebHandler(app)
}

test('multipart reading preserves an upload and its separate mapping field', async () => {
  const body = new FormData()
  body.append('file', new File(['012345'], 'Beleg Käse.pdf'))
  body.append('mapping', '{}')
  const response = await handler(6)(new Request('http://local', { method: 'POST', body }))
  expect(await response.json()).toEqual({ filename: 'Beleg Käse.pdf', size: 6, mapping: '{}' })
})

test('multipart reading rejects oversize files and ambiguous duplicate parts', async () => {
  const body = new FormData()
  const file = new File(['012345'], 'Beleg.pdf')
  body.append('file', file)
  const request = () => new Request('http://local', { method: 'POST', body })
  expect((await handler(5)(request())).status).toBe(413)
  body.append('file', file)
  expect((await handler(10)(request())).status).toBe(422)
})
