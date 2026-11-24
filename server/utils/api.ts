import type {} from '../types'
import { defineHandler, type H3Event } from 'nitro/h3'
import { z } from 'zod'
import { AccessError, requireAccess, type Action } from '../modules/identity/access'
import { requireSession, requireWriteProtection } from '../modules/identity/session'
import { ApiError } from '../modules/http-error'
import { readBoundedBody } from './body'

export { ApiError }

const accessMessages: Record<string, string> = {
  unauthenticated: 'Bitte anmelden.',
  reauth_required: 'Bitte erneut anmelden, um die Bereichsrechte zu aktualisieren.',
  not_found: 'Nicht gefunden.',
  forbidden: 'Für diese Aktion fehlen die Berechtigungen.',
}

function isStorageBusy(error: unknown): boolean {
  for (let depth = 0; depth < 4 && error instanceof Error; depth++) {
    if ('code' in error && typeof error.code === 'string' && /^SQLITE_(BUSY|LOCKED)(_|$)/.test(error.code)) return true
    error = error.cause
  }
  return false
}

export function endpoint<T>(handler: (event: H3Event) => T) {
  return defineHandler(async (event) => {
    try {
      return await handler(event)
    } catch (error) {
      let failure: ApiError
      if (error instanceof ApiError) failure = error
      else if (error instanceof AccessError) failure = new ApiError(error.statusCode, error.code, accessMessages[error.code] ?? 'Zugriff verweigert.')
      else if (isStorageBusy(error)) failure = new ApiError(503, 'storage_busy', 'Die Datenbank ist ausgelastet. Bitte erneut versuchen.')
      else {
        console.error('Unerwarteter API-Fehler', error instanceof Error ? error.name : typeof error)
        failure = new ApiError(500, 'internal_error', 'Interner Serverfehler.')
      }
      event.res.status = failure.statusCode
      return { error: { code: failure.code, message: failure.message, fields: failure.fields } }
    }
  })
}

export function access(event: H3Event, action: Action) {
  const session = requireSession(event)
  const context = requireAccess(session, event.context.params?.w ?? '', action,
    event.context.accessConfig, event.context.identityConfig?.groupsMaxAgeSeconds)
  if (action !== 'read') requireWriteProtection(event, session)
  return context
}

const germanValidation = z.locales.de().localeError

export function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value, { error: germanValidation })
  if (result.success) return result.data
  const fields = new Map<string, string>()
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.') || '_form'
    if (!fields.has(path)) fields.set(path, issue.message)
  }
  throw new ApiError(422, 'validation_failed', 'Bitte die Eingaben prüfen.', Object.fromEntries(fields))
}

export async function readJson(event: H3Event): Promise<unknown> {
  const contentType = event.req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new ApiError(415, 'unsupported_media_type', 'Dieser Aufruf erwartet JSON.')
  const tooLarge = new ApiError(413, 'payload_too_large', 'Die Anfrage ist zu groß.')
  const invalid = new ApiError(422, 'validation_failed', 'Die Anfrage enthält kein gültiges JSON.')
  const body = await readBoundedBody(event, 64 * 1024, tooLarge, invalid)
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
  } catch { throw invalid }
}
