import { expect, it } from 'vitest'
import { accessConfigSchema } from '../shared/schemas/access'
import { requireAccess } from '../server/modules/identity/access'
const a = '5ec8df94-adc0-4874-807a-98343ac9cff2'
const b = 'fde5a7ae-a719-41e2-9dbb-8aec3ab71fc9'
const config = accessConfigSchema.parse({ workspaces: [{ id: a, name: 'A', currency: 'EUR' }, { id: b, name: 'B', currency: 'EUR' }], groupMappings: [{ group: 'reader', workspaceId: a, role: 'reader' }, { group: 'owner', workspaceId: a, role: 'owner' }] })
const now = 1_000_000
const session = { userId: 'user', expiresAt: now + 10000, groupsCheckedAt: now, groups: ['reader', 'owner'] }
it('uses highest exact role and confines access to the mapped workspace', () => {
  expect(requireAccess(session, a, 'manage', config, 900, now).role).toBe('owner')
  expect(() => requireAccess(session, b, 'read', config, 900, now)).toThrow('not_found')
  expect(() => requireAccess({ ...session, groups: ['owner-extra'] }, a, 'read', config, 900, now)).toThrow('not_found')
  expect(() => requireAccess({ ...session, groups: ['reader'] }, a, 'write', config, 900, now)).toThrow('forbidden')
})
it('rejects expired sessions and groups at the 900 second cutoff', () => {
  expect(() => requireAccess(null, a, 'read', config, 900, now)).toThrow('unauthenticated')
  expect(() => requireAccess({ ...session, expiresAt: now }, a, 'read', config, 900, now)).toThrow('unauthenticated')
  expect(() => requireAccess({ ...session, groupsCheckedAt: now - 900000 }, a, 'read', config, 900, now)).toThrow('reauth_required')
})
it('rejects duplicate workspaces and dangling mappings', () => {
  expect(accessConfigSchema.safeParse({ ...config, workspaces: [config.workspaces[0], config.workspaces[0]] }).success).toBe(false)
  expect(accessConfigSchema.safeParse({ ...config, workspaces: [] }).success).toBe(false)
})
