import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { z } from 'zod'
import { accessConfigSchema } from '../shared/schemas/access'

const groupsMaxAgeSchema = z.coerce.number().int().min(1).max(900)
const configSchema = z.object({
  databasePath: z.string().min(1), receiptsPath: z.string().min(1), accessConfigPath: z.string().min(1),
  groupsMaxAgeSeconds: groupsMaxAgeSchema,
})

export function loadStorageConfig(env = process.env) {
  const config = configSchema.parse({
    databasePath: env.NUXT_DATABASE_PATH ?? './.data/wimm.sqlite',
    receiptsPath: env.NUXT_RECEIPTS_PATH ?? './.data/receipts',
    accessConfigPath: env.NUXT_ACCESS_CONFIG_PATH ?? './deploy/access.json',
    groupsMaxAgeSeconds: env.NUXT_GROUPS_MAX_AGE_SECONDS ?? 900,
  })
  const access = accessConfigSchema.parse(JSON.parse(readFileSync(resolve(config.accessConfigPath), 'utf8')))
  return { ...config, access }
}

export function trustedHttpUrl(value: string): URL {
  const url = new URL(value)
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.hash) {
    throw new Error('HTTPS oder eine lokale HTTP-Adresse erwartet.')
  }
  return url
}

const identityConfigSchema = z.object({
  appUrl: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  discoveryUrl: z.string().min(1),
  redirectUrl: z.string().min(1),
  issuer: z.string().min(1),
  cookiePassword: z.string().min(32),
  scopes: z.array(z.string().regex(/^[\x21\x23-\x5B\x5D-\x7E]+$/)),
  groupsClaim: z.string().min(1),
  groupsMaxAgeSeconds: groupsMaxAgeSchema,
})

export function loadIdentityConfig(env = process.env) {
  const oidc = {
    clientId: env.NUXT_OAUTH_OIDC_CLIENT_ID,
    clientSecret: env.NUXT_OAUTH_OIDC_CLIENT_SECRET,
    discoveryUrl: env.NUXT_OAUTH_OIDC_OPENID_CONFIG,
    redirectUrl: env.NUXT_OAUTH_OIDC_REDIRECT_URL,
    issuer: env.NUXT_OIDC_ISSUER,
  }
  if (Object.values(oidc).every(value => !value)) return null

  const result = identityConfigSchema.safeParse({
    ...oidc,
    appUrl: env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    cookiePassword: env.NUXT_SESSION_PASSWORD,
    scopes: (env.NUXT_OIDC_SCOPES ?? 'openid,profile,email,groups').split(',').map(scope => scope.trim()).filter(Boolean),
    groupsClaim: env.NUXT_OIDC_GROUPS_CLAIM ?? 'groups',
    groupsMaxAgeSeconds: env.NUXT_GROUPS_MAX_AGE_SECONDS ?? 900,
  })
  if (!result.success) throw new Error(`OIDC-Konfiguration ungültig (${result.error.issues.map(issue => issue.path.join('.')).join(', ')}).`)
  const { cookiePassword, appUrl, scopes, ...config } = result.data
  const app = trustedHttpUrl(appUrl)
  const discovery = trustedHttpUrl(config.discoveryUrl)
  const issuer = trustedHttpUrl(config.issuer)
  if (app.href !== `${app.origin}/` || config.redirectUrl !== `${app.origin}/auth/oidc`) {
    throw new Error('Die konfigurierte OIDC-Callback-Adresse muss auf /auth/oidc der öffentlichen Anwendung zeigen.')
  }
  if (issuer.search || (issuer.protocol === 'https:' && discovery.protocol !== 'https:')) {
    throw new Error('Issuer und Discovery-Adresse der OIDC-Konfiguration prüfen.')
  }
  return {
    ...config,
    discoveryUrl: discovery.href,
    origin: app.origin,
    secure: app.protocol === 'https:',
    scopes: [...new Set(['openid', ...scopes])].join(' '),
    cookieKey: createHash('sha256').update(cookiePassword).digest(),
  }
}

export type IdentityConfig = NonNullable<ReturnType<typeof loadIdentityConfig>>
