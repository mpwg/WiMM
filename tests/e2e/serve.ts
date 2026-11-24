import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateDatabase } from '../../server/db/lifecycle'
import { accessConfigSchema } from '../../shared/schemas/access'
import { startTestOidcProvider, testCookiePassword, testOidcClientId, testOidcClientSecret } from '../support/oidc'

const host = '127.0.0.1'
const port = 3000
const appUrl = `http://${host}:${port}`
const directory = mkdtempSync(join(tmpdir(), 'wimm-playwright-'))
const databasePath = join(directory, 'wimm.sqlite')
const configPath = join(directory, 'access.json')
const household = '5ec8df94-adc0-4874-807a-98343ac9cff2'
const club = 'fde5a7ae-a719-41e2-9dbb-8aec3ab71fc9'
const archive = '62f15160-b99a-4b5b-ae58-5dfb18e8e052'
const projects = 'b681406c-a2c9-4ea9-a352-67ba9a69817b'
const access = accessConfigSchema.parse({
  workspaces: [
    { id: household, name: 'Haushalt', currency: 'EUR' },
    { id: club, name: 'Verein', currency: 'EUR' },
    { id: archive, name: 'Archiv', currency: 'EUR' },
    { id: projects, name: 'Projekte', currency: 'EUR' },
  ],
  groupMappings: [
    { group: 'wimm-haushalt-owner', workspaceId: household, role: 'owner' },
    { group: 'wimm-verein-owner', workspaceId: club, role: 'owner' },
    { group: 'wimm-archiv-reader', workspaceId: archive, role: 'reader' },
    { group: 'wimm-projekte-editor', workspaceId: projects, role: 'editor' },
  ],
})
let provider: Awaited<ReturnType<typeof startTestOidcProvider>> | undefined
let app: ReturnType<typeof Bun.spawn> | undefined
try {
  writeFileSync(configPath, JSON.stringify(access))
  migrateDatabase(databasePath, access)
  provider = await startTestOidcProvider({ profile: { groups: access.groupMappings.map(mapping => mapping.group) } })
  app = Bun.spawn([process.execPath, '.output/server/index.mjs'], {
    stdout: 'inherit', stderr: 'inherit',
    env: {
      ...process.env, NITRO_HOST: host, NITRO_PORT: String(port),
      NUXT_DATABASE_PATH: databasePath, NUXT_RECEIPTS_PATH: join(directory, 'receipts'),
      NUXT_ACCESS_CONFIG_PATH: configPath, NUXT_PUBLIC_APP_URL: appUrl,
      NUXT_SESSION_PASSWORD: testCookiePassword,
      NUXT_OAUTH_OIDC_CLIENT_ID: testOidcClientId, NUXT_OAUTH_OIDC_CLIENT_SECRET: testOidcClientSecret,
      NUXT_OAUTH_OIDC_OPENID_CONFIG: `${provider.issuer}/.well-known/openid-configuration`,
      NUXT_OAUTH_OIDC_REDIRECT_URL: `${appUrl}/auth/oidc`, NUXT_OIDC_ISSUER: provider.issuer,
      NUXT_OIDC_SCOPES: 'openid,profile,groups', NUXT_OIDC_GROUPS_CLAIM: 'groups', NUXT_GROUPS_MAX_AGE_SECONDS: '900',
    },
  })
  const stop = () => app?.kill('SIGTERM')
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  process.exitCode = await app.exited
} finally {
  provider?.stop()
  rmSync(directory, { recursive: true, force: true })
}
