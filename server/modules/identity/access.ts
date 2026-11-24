import type { AccessConfig, Role } from '../../../shared/schemas/access'

export type Action = 'read' | 'write' | 'manage'
export type AccessContext = Readonly<{ userId: string, workspaceId: string, role: Role }>
export type Session = Readonly<{ userId: string, expiresAt: number, groupsCheckedAt: number, groups: string[] }>
const rank: Record<Role, number> = { reader: 0, editor: 1, owner: 2 }
const required: Record<Action, number> = { read: 0, write: 1, manage: 2 }

export class AccessError extends Error {
  constructor(public statusCode: number, public code: string) { super(code) }
}

export function requireCurrentSession<T extends Session>(session: T | null, maxAgeSeconds = 900, now = Date.now()): T {
  if (!session || session.expiresAt <= now) throw new AccessError(401, 'unauthenticated')
  if (session.groupsCheckedAt > now || now - session.groupsCheckedAt >= Math.min(maxAgeSeconds, 900) * 1000) throw new AccessError(401, 'reauth_required')
  return session
}

function workspaceRoles(groups: string[], config: AccessConfig) {
  const roles = new Map<string, Role>()
  const groupSet = new Set(groups)
  for (const mapping of config.groupMappings) {
    if (!groupSet.has(mapping.group)) continue
    const role = roles.get(mapping.workspaceId)
    if (role === undefined || rank[mapping.role] > rank[role]) roles.set(mapping.workspaceId, mapping.role)
  }
  return roles
}

export function listWorkspaces(session: Session, config: AccessConfig) {
  const roles = workspaceRoles(session.groups, config)
  return config.workspaces.flatMap(workspace => {
    const role = roles.get(workspace.id)
    return role ? [{ ...workspace, role }] : []
  })
}

export function requireAccess(session: Session | null, workspaceId: string, action: Action, config: AccessConfig, maxAgeSeconds = 900, now = Date.now()): AccessContext {
  const current = requireCurrentSession(session, maxAgeSeconds, now)
  if (!config.workspaces.some(workspace => workspace.id === workspaceId)) throw new AccessError(404, 'not_found')
  const role = workspaceRoles(current.groups, config).get(workspaceId)
  if (role === undefined) throw new AccessError(404, 'not_found')
  if (rank[role] < required[action]) throw new AccessError(403, 'forbidden')
  return Object.freeze({ userId: current.userId, workspaceId, role })
}
