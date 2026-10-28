import type { AccessConfig, Role } from '../../../shared/schemas/access'

export type Action = 'read' | 'write' | 'manage'
export type AccessContext = Readonly<{ userId: string, workspaceId: string, role: Role }>
export type Session = { userId: string, expiresAt: number, groupsCheckedAt: number, groups: string[] }
const rank: Record<Role, number> = { reader: 0, editor: 1, owner: 2 }
const required: Record<Action, number> = { read: 0, write: 1, manage: 2 }

export class AccessError extends Error {
  constructor(public statusCode: number, public code: string) { super(code) }
}

// Callers must load the session from SQLite, never from browser-supplied claims.
export function requireAccess(session: Session | null, workspaceId: string, action: Action, config: AccessConfig, maxAgeSeconds = 900, now = Date.now()): AccessContext {
  if (!session || session.expiresAt <= now) throw new AccessError(401, 'unauthenticated')
  if (session.groupsCheckedAt > now || now - session.groupsCheckedAt >= Math.min(maxAgeSeconds, 900) * 1000) throw new AccessError(401, 'reauth_required')
  if (!config.workspaces.some(w => w.id === workspaceId)) throw new AccessError(404, 'not_found')
  let role: Role | undefined
  for (const mapping of config.groupMappings) {
    if (mapping.workspaceId === workspaceId && session.groups.includes(mapping.group) && (role === undefined || rank[mapping.role] > rank[role])) role = mapping.role
  }
  if (role === undefined) throw new AccessError(404, 'not_found')
  if (rank[role] < required[action]) throw new AccessError(403, 'forbidden')
  return Object.freeze({ userId: session.userId, workspaceId, role })
}
