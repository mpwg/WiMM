import { randomUUID } from 'node:crypto'
import { eq, lte } from 'drizzle-orm'
import { getRequestHeader, type H3Event } from 'h3'
import type { IdentityConfig } from '../../config'
import type { Connection } from '../../db/client'
import { identities, sessions } from '../../db/schema'
import { ApiError } from '../http-error'
import { AccessError, requireCurrentSession } from './access'
import { clearIdentityCookie, randomToken, readIdentityCookie, setIdentityCookie, tokenMatches } from './cookies'

const sessionLifetimeSeconds = 24 * 60 * 60

export type VerifiedIdentity = Readonly<{
  issuer: string
  subject: string
  displayName: string
  groups: string[]
}>

function loadSession(event: H3Event) {
  const config = event.context.identityConfig
  if (!config) return null
  const id = readIdentityCookie(event, config, 'session')
  if (!id) return null
  const storage: Connection = event.context.storage
  return storage.db.select({
    id: sessions.id,
    userId: sessions.userId,
    displayName: identities.displayName,
    csrfToken: sessions.csrfToken,
    groups: sessions.groups,
    groupsCheckedAt: sessions.groupsCheckedAt,
    expiresAt: sessions.expiresAt,
  }).from(sessions).innerJoin(identities, eq(sessions.userId, identities.id)).where(eq(sessions.id, id)).get() ?? null
}

export function requireSession(event: H3Event) {
  return requireCurrentSession(loadSession(event), event.context.identityConfig?.groupsMaxAgeSeconds)
}

export function requireWriteProtection(event: H3Event, session: { csrfToken: string }) {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || origin !== event.context.identityConfig?.origin ||
    !tokenMatches(getRequestHeader(event, 'x-csrf-token'), session.csrfToken)) {
    throw new ApiError(403, 'csrf_failed', 'Die Anfrage konnte nicht bestätigt werden.')
  }
}

export function startSession(event: H3Event, config: IdentityConfig, identity: VerifiedIdentity) {
  const now = Date.now()
  const id = randomUUID()
  const previousId = readIdentityCookie(event, config, 'session')
  const storage: Connection = event.context.storage
  storage.db.transaction(tx => {
    tx.delete(sessions).where(lte(sessions.expiresAt, now)).run()
    if (previousId) tx.delete(sessions).where(eq(sessions.id, previousId)).run()
    const { id: userId } = tx.insert(identities).values({
      id: randomUUID(), issuer: identity.issuer, subject: identity.subject, displayName: identity.displayName,
    }).onConflictDoUpdate({ target: [identities.issuer, identities.subject], set: { displayName: identity.displayName } })
      .returning({ id: identities.id }).get()!
    tx.insert(sessions).values({
      id, userId, groups: identity.groups, groupsCheckedAt: now,
      expiresAt: now + sessionLifetimeSeconds * 1000, csrfToken: randomToken(),
    }).run()
  })
  setIdentityCookie(event, config, 'session', id, sessionLifetimeSeconds)
}

export function revokeSession(event: H3Event) {
  const config = event.context.identityConfig
  const session = loadSession(event)
  if (!config || !session) throw new AccessError(401, 'unauthenticated')
  requireWriteProtection(event, session)
  event.context.storage.db.delete(sessions).where(eq(sessions.id, session.id)).run()
  clearIdentityCookie(event, config, 'session')
}
