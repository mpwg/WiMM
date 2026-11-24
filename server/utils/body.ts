import { assertBodySize, HTTPError, type H3Event } from 'nitro/h3'
import type { ApiError } from '../modules/http-error'

export async function readBoundedBody(event: H3Event, maximumBytes: number, tooLarge: ApiError, invalid: ApiError) {
  if (!event.req.body) throw invalid
  try {
    assertBodySize(event, maximumBytes)
    return Buffer.from(await event.req.arrayBuffer())
  } catch (error) {
    if (!HTTPError.isError(error) || error.status !== 413) throw invalid
    if (event.req.headers.has('transfer-encoding') || event.req.headers.has('connection')) {
      event.res.headers.set('connection', 'close')
    }
    throw tooLarge
  }
}
