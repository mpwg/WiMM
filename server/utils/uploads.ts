import type { H3Event } from 'nitro/h3'
import { ApiError } from '../modules/http-error'
import { readBoundedBody } from './body'

const multipartOverhead = 1024 * 1024

export async function readUpload(event: H3Event, fileLimit: number, fieldNames: string[] = []) {
  const contentType = event.req.headers.get('content-type')
  if (contentType?.split(';')[0]?.trim().toLowerCase() !== 'multipart/form-data') {
    throw new ApiError(415, 'unsupported_media_type', 'Dieser Aufruf erwartet multipart/form-data.')
  }
  const maximumBytes = fileLimit + multipartOverhead
  const tooLarge = new ApiError(413, 'payload_too_large', 'Die Datei oder Anfrage ist zu groß.')
  const invalid = new ApiError(422, 'validation_failed', 'Die Anfrage enthält keinen gültigen Dateiupload.')
  const bytes = await readBoundedBody(event, maximumBytes, tooLarge, invalid)
  let form: FormData
  try {
    form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData()
  } catch {
    throw invalid
  }
  const files = form.getAll('file')
  if (files.length !== 1 || !(files[0] instanceof File)) throw invalid
  const file = files[0]
  if (file.size > fileLimit) throw tooLarge
  const fields = new Map<string, string>()
  for (const [name, value] of form) {
    if (name === 'file') continue
    if (!fieldNames.includes(name) || fields.has(name) || typeof value !== 'string') throw invalid
    fields.set(name, value)
  }
  return { file, fields }
}
