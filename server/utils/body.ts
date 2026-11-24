import { getRequestHeader, getRequestWebStream, setResponseHeader, type H3Event } from 'h3'
import type { ApiError } from '../modules/http-error'

export async function readBoundedBody(event: H3Event, maximumBytes: number, tooLarge: ApiError, invalid: ApiError) {
  const request = event.node.req
  const isNodeRequest = !event.web && !('__unenv__' in request) && typeof request.iterator === 'function'
  const chunks: Uint8Array[] = []
  let size = 0
  function collect(chunk: Uint8Array) {
    size += chunk.byteLength
    if (size > maximumBytes) throw tooLarge
    chunks.push(chunk)
  }
  try {
    if (Number(getRequestHeader(event, 'content-length')) > maximumBytes) throw tooLarge
    if (isNodeRequest) {
      // Stop iterating without destroying the socket before the 413 can be sent.
      for await (const chunk of request.iterator({ destroyOnReturn: false })) collect(chunk)
    } else {
      const stream = getRequestWebStream(event)
      if (!stream) throw invalid
      const reader = stream.getReader()
      try {
        for (;;) {
          const result = await reader.read()
          if (result.done) break
          collect(result.value)
        }
      } catch (error) {
        void reader.cancel().catch(() => {})
        throw error
      } finally {
        reader.releaseLock()
      }
    }
  } catch (error) {
    if (error !== tooLarge) throw invalid
    if (isNodeRequest) setResponseHeader(event, 'connection', 'close')
    throw tooLarge
  }
  return Buffer.concat(chunks, size)
}
