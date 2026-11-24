import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import logout from '../server/api/logout.post'
import sessionRoute from '../server/api/session.get'
import workspacesRoute from '../server/api/workspaces/index.get'
import { loadIdentityConfig } from '../server/config'
import { openDatabase } from '../server/db/client'
import { migrateDatabase } from '../server/db/lifecycle'
import { identities, sessions } from '../server/db/schema'
import security from '../server/middleware/security'
import login from '../server/routes/auth/oidc.get'
import { access, endpoint } from '../server/utils/api'
import { accessConfigSchema } from '../shared/schemas/access'
import { startTestOidcProvider, testCookiePassword, testOidcClientId, testOidcClientSecret } from './support/oidc'

const origin = 'http://localhost:3000'
const home = '5ec8df94-adc0-4874-807a-98343ac9cff2'
const privateWorkspace = 'fde5a7ae-a719-41e2-9dbb-8aec3ab71fc9'
const accessConfig = accessConfigSchema.parse({
  workspaces: [
    { id: home, name: 'Haushalt', currency: 'EUR' },
    { id: privateWorkspace, name: 'Privat', currency: 'EUR' },
  ],
  groupMappings: [
    { group: 'household-owner', workspaceId: home, role: 'owner' },
    { group: 'household-reader', workspaceId: home, role: 'reader' },
    { group: 'private-owner', workspaceId: privateWorkspace, role: 'owner' },
  ],
})

const router = createRouter()
router.get('/auth/oidc', login).get('/api/session', sessionRoute).get('/api/workspaces', workspacesRoute).post('/api/logout', logout)
router.get('/api/workspaces/:w/resource', endpoint(event => access(event, 'read')))
router.post('/api/workspaces/:w/resource', endpoint(event => access(event, 'write')))
const request = toWebHandler(createApp().use(security).use(router))

let provider: Awaited<ReturnType<typeof startTestOidcProvider>>
let directory: string
let storage: ReturnType<typeof openDatabase>
let identityConfig: NonNullable<ReturnType<typeof loadIdentityConfig>>

beforeAll(async () => {
  provider = await startTestOidcProvider()
  directory = mkdtempSync(join(tmpdir(), 'wimm-oidc-'))
  const path = join(directory, 'wimm.sqlite')
  migrateDatabase(path, accessConfig)
  storage = openDatabase(path)
  identityConfig = loadIdentityConfig({
    NUXT_PUBLIC_APP_URL: origin,
    NUXT_SESSION_PASSWORD: testCookiePassword,
    NUXT_OAUTH_OIDC_CLIENT_ID: testOidcClientId,
    NUXT_OAUTH_OIDC_CLIENT_SECRET: testOidcClientSecret,
    NUXT_OAUTH_OIDC_OPENID_CONFIG: `${provider.issuer}/.well-known/openid-configuration`,
    NUXT_OAUTH_OIDC_REDIRECT_URL: `${origin}/auth/oidc`,
    NUXT_OIDC_ISSUER: provider.issuer,
  })!
})

beforeEach(() => {
  provider.setAvailable(true)
  provider.setProfile({ groups: ['household-reader', 'household-owner'] })
  storage.db.delete(identities).run()
})

afterAll(() => {
  provider?.stop()
  storage?.sqlite.close()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

function browser() {
  const cookies = new Map<string, string>()
  async function app(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    if (!headers.has('cookie')) headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '))
    const response = await request(new Request(new URL(path, origin), { ...init, headers }), { identityConfig, storage, accessConfig, receiptsPath: directory })
    for (const cookie of response.headers.getSetCookie()) {
      const [name, value] = cookie.split(';', 1)[0]!.split('=', 2) as [string, string]
      if (value) cookies.set(name, value)
      else cookies.delete(name)
    }
    return response
  }
  async function begin() {
    const response = await app('/auth/oidc?returnTo=https://fremd.example')
    expect(response.status).toBe(302)
    const authorization = new URL(response.headers.get('location')!)
    expect(authorization.origin).toBe(provider.issuer)
    expect(response.headers.getSetCookie()[0]).toContain('HttpOnly')
    const redirect = await fetch(authorization, { redirect: 'manual' })
    expect(redirect.status).toBe(302)
    return new URL(redirect.headers.get('location')!)
  }
  const callback = (url: URL) => app(url.pathname + url.search)
  return { app, begin, callback, cookies, async login() { return callback(await begin()) } }
}

test('issues a database-backed session once after verifying the provider and grants the highest mapped role', async () => {
  const client = browser()
  const login = await client.login()
  expect(login.headers.get('location')).toBe('/')
  expect(login.headers.getSetCookie().find(cookie => cookie.startsWith('wimm_session='))).toMatch(/Path=\/;.*HttpOnly.*SameSite=Lax/)
  const response = await client.app('/api/session')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const session = await response.json()
  expect(session).toEqual({
    user: { id: expect.any(String), displayName: 'Lokaler Benutzer' }, csrfToken: expect.any(String),
    workspaces: [{ id: home, name: 'Haushalt', currency: 'EUR', role: 'owner' }],
  })
  const [row] = storage.db.select().from(sessions).all()
  expect(row?.userId).toBe(session.user.id)
  expect(client.cookies.get('wimm_session')).not.toContain(row!.id)
  expect(client.cookies.get('wimm_session')).not.toContain(session.csrfToken)
  expect((await client.app('/api/_auth/session')).status).toBe(404)
  expect((await client.app(`/api/workspaces/${privateWorkspace}/resource`)).status).toBe(404)
  expect(await (await client.app('/api/workspaces')).json()).toEqual({ items: session.workspaces })
})

test('rejects missing and mismatched state without creating a database session', async () => {
  const client = browser()
  const callback = await client.begin()
  const originalState = callback.searchParams.get('state')!
  callback.searchParams.set('state', 'falscher-status')
  expect((await client.callback(callback)).headers.get('location')).toBe('/?login=failed')
  callback.searchParams.set('state', originalState)
  expect((await client.callback(callback)).headers.get('location')).toBe('/?login=failed')
  expect(storage.db.select().from(sessions).all()).toHaveLength(0)
})

const rejectedProfiles: [string, Parameters<typeof provider.setProfile>[0]][] = [
  ['falsche Nonce', { idClaims: { nonce: 'invalid' } }],
  ['fehlende Nonce', { idClaims: { nonce: undefined } }],
  ['falscher Issuer', { idClaims: { iss: 'https://fremd.example' } }],
  ['falscher Empfänger', { idClaims: { aud: 'anderer-client' } }],
  ['falscher azp', { idClaims: { azp: 'anderer-client' } }],
  ['mehrere Empfänger ohne azp', { idClaims: { aud: [testOidcClientId, 'anderer-client'] } }],
  ['abgelaufenes Token', { idClaims: { exp: 1 } }],
  ['fehlender Ausstellungszeitpunkt', { idClaims: { iat: undefined } }],
  ['falsches UserInfo-Subject', { userinfoSubject: 'falscher-benutzer' }],
  ['falsche Signatur', { signWithWrongKey: true }],
]

test.each(rejectedProfiles)('lehnt %s ab', async (_label, profile) => {
  const client = browser()
  provider.setProfile({ ...profile, groups: ['household-owner'] })
  expect((await client.login()).headers.get('location')).toBe('/?login=failed')
  expect((await client.app('/api/session')).status).toBe(401)
  expect(storage.db.select().from(sessions).all()).toHaveLength(0)
})

test('drops stale rights even when the provider is unavailable, then reloads current groups on login', async () => {
  const client = browser()
  await client.login()
  const oldCookie = client.cookies.get('wimm_session')!
  const before = await (await client.app('/api/session')).json()
  storage.db.update(sessions).set({ groupsCheckedAt: Date.now() - 900_000 }).run()
  provider.setAvailable(false)
  const stale = await client.app(`/api/workspaces/${home}/resource`)
  expect(stale.status).toBe(401)
  expect(await stale.json()).toMatchObject({ error: { code: 'reauth_required' } })
  expect((await client.app('/auth/oidc')).headers.get('location')).toBe('/?login=unavailable')
  provider.setAvailable(true)
  provider.setProfile({ groups: ['household-reader'] })
  await client.login()
  const after = await (await client.app('/api/session')).json()
  expect(after.user.id).toBe(before.user.id)
  expect(after.workspaces).toEqual([{ id: home, name: 'Haushalt', currency: 'EUR', role: 'reader' }])
  expect((await client.app('/api/session', { headers: { cookie: `wimm_session=${oldCookie}` } })).status).toBe(401)
  const write = await client.app(`/api/workspaces/${home}/resource`, { method: 'POST', headers: { origin, 'x-csrf-token': after.csrfToken } })
  expect(write.status).toBe(403)
  expect(await write.json()).toMatchObject({ error: { code: 'forbidden' } })
})

test.each([{ groups: undefined }, { groups: 'household-owner' }, { groups: ['household-owner', 5] }])('grants no rights for missing or malformed groups %j', async ({ groups }) => {
  const client = browser()
  provider.setProfile({ groups })
  expect((await client.login()).headers.get('location')).toBe('/')
  expect(await (await client.app('/api/session')).json()).toMatchObject({ workspaces: [] })
  expect((await client.app(`/api/workspaces/${home}/resource`)).status).toBe(404)
})

test('checks CSRF on writes and revokes the session on logout', async () => {
  const client = browser()
  await client.login()
  const cookie = `wimm_session=${client.cookies.get('wimm_session')}`
  const { csrfToken } = await (await client.app('/api/session')).json()
  const wrongOrigin = await client.app('/api/logout', { method: 'POST', headers: { origin: 'https://fremd.example', 'x-csrf-token': csrfToken } })
  expect(wrongOrigin.status).toBe(403)
  const missingToken = await client.app(`/api/workspaces/${home}/resource`, { method: 'POST', headers: { origin } })
  expect(missingToken.status).toBe(403)
  expect(await missingToken.json()).toMatchObject({ error: { code: 'csrf_failed' } })
  expect((await client.app(`/api/workspaces/${home}/resource`, { method: 'POST', headers: { origin, 'x-csrf-token': csrfToken } })).status).toBe(200)
  expect((await client.app('/api/logout', { method: 'POST', headers: { origin, 'x-csrf-token': csrfToken } })).status).toBe(204)
  expect(client.cookies.has('wimm_session')).toBe(false)
  expect((await client.app('/api/session', { headers: { cookie } })).status).toBe(401)
})
