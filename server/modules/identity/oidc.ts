import { createHash } from 'node:crypto'
import { getQuery, redirect, type H3Event } from 'nitro/h3'
import { createRemoteJWKSet, customFetch, errors as joseErrors, jwtVerify } from 'jose'
import { z } from 'zod'
import { trustedHttpUrl, type IdentityConfig } from '../../config'
import { clearIdentityCookie, randomToken, readIdentityCookie, setIdentityCookie, tokenMatches } from './cookies'
import { startSession, type VerifiedIdentity } from './session'

const flowLifetimeSeconds = 5 * 60
const supportedSigningAlgorithms = new Set(['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA', 'Ed25519'])
const authMethods = ['client_secret_basic', 'client_secret_post'] as const
const metadataSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  userinfo_endpoint: z.string(),
  jwks_uri: z.string(),
  id_token_signing_alg_values_supported: z.array(z.string()).default(['RS256']),
  token_endpoint_auth_methods_supported: z.array(z.string()).default(['client_secret_basic']),
  code_challenge_methods_supported: z.array(z.string()).optional(),
  authorization_response_iss_parameter_supported: z.boolean().optional(),
})
const flowSchema = z.object({
  state: z.string().length(43), nonce: z.string().length(43), verifier: z.string().length(43), expiresAt: z.number(),
})
const tokenSchema = z.object({ id_token: z.string().min(1), access_token: z.string().regex(/^[A-Za-z0-9._~+\/-]+=*$/), token_type: z.string().regex(/^Bearer$/i) })
const subjectSchema = z.string().regex(/^[\x21-\x7e]{1,255}$/)
const groupSchema = z.array(z.string())
const displayNameSchema = z.string().trim().min(1).max(200)
type Flow = z.infer<typeof flowSchema>

class LoginFailure extends Error {
  constructor(readonly reason: 'failed' | 'unavailable') { super(reason) }
}

async function providerFetch(url: string | URL, options?: RequestInit) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), ...options, redirect: 'error' })
    if (response.status >= 500) throw new LoginFailure('unavailable')
    return response
  } catch { throw new LoginFailure('unavailable') }
}

async function providerJson(url: string | URL, options?: RequestInit, failure: 'failed' | 'unavailable' = 'failed'): Promise<unknown> {
  const response = await providerFetch(url, options)
  if (!response.ok) throw new LoginFailure(failure)
  try { return await response.json() } catch { throw new LoginFailure(failure) }
}

async function discover(config: IdentityConfig) {
  const data = metadataSchema.safeParse(await providerJson(config.discoveryUrl, undefined, 'unavailable'))
  if (!data.success || data.data.issuer !== config.issuer) throw new LoginFailure('unavailable')
  const metadata = data.data
  const algorithms = metadata.id_token_signing_alg_values_supported.filter(alg => supportedSigningAlgorithms.has(alg))
  const authMethod = authMethods.find(method => metadata.token_endpoint_auth_methods_supported.includes(method))
  if (algorithms.length === 0 || !authMethod || (metadata.code_challenge_methods_supported && !metadata.code_challenge_methods_supported.includes('S256'))) {
    throw new LoginFailure('unavailable')
  }
  function endpoint(value: string) {
    const url = trustedHttpUrl(value)
    if (config.issuer.startsWith('https:') && url.protocol !== 'https:') throw new LoginFailure('unavailable')
    return url
  }
  return {
    authorization: endpoint(metadata.authorization_endpoint), token: endpoint(metadata.token_endpoint),
    userinfo: endpoint(metadata.userinfo_endpoint), jwks: endpoint(metadata.jwks_uri), algorithms, authMethod,
    requireResponseIssuer: metadata.authorization_response_iss_parameter_supported === true,
  }
}

function readFlow(event: H3Event, config: IdentityConfig): Flow {
  const cookie = readIdentityCookie(event, config, 'flow')
  clearIdentityCookie(event, config, 'flow')
  if (!cookie) throw new LoginFailure('failed')
  const result = flowSchema.safeParse(JSON.parse(cookie))
  if (!result.success || result.data.expiresAt <= Date.now()) throw new LoginFailure('failed')
  return result.data
}

function authorizationUrl(event: H3Event, config: IdentityConfig, url: URL) {
  const flow: Flow = {
    state: randomToken(), nonce: randomToken(), verifier: randomToken(), expiresAt: Date.now() + flowLifetimeSeconds * 1000,
  }
  setIdentityCookie(event, config, 'flow', JSON.stringify(flow), flowLifetimeSeconds)
  const challenge = createHash('sha256').update(flow.verifier).digest('base64url')
  const parameters = {
    client_id: config.clientId, redirect_uri: config.redirectUrl, response_type: 'code', scope: config.scopes,
    state: flow.state, nonce: flow.nonce, code_challenge: challenge, code_challenge_method: 'S256',
  }
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
  return url.href
}

function formEncode(value: string) {
  return new URLSearchParams({ v: value }).toString().slice(2)
}

async function exchangeCode(config: IdentityConfig, provider: Awaited<ReturnType<typeof discover>>, code: string, verifier: string) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: config.redirectUrl })
  const headers: Record<string, string> = { accept: 'application/json' }
  if (provider.authMethod === 'client_secret_basic') {
    const credentials = `${formEncode(config.clientId)}:${formEncode(config.clientSecret)}`
    headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`
  } else {
    body.set('client_id', config.clientId)
    body.set('client_secret', config.clientSecret)
  }
  const tokens = tokenSchema.safeParse(await providerJson(provider.token, { method: 'POST', headers, body }))
  if (!tokens.success) throw new LoginFailure('failed')
  return tokens.data
}

async function verifyToken(config: IdentityConfig, provider: Awaited<ReturnType<typeof discover>>, token: string, nonce: string) {
  const keySet = createRemoteJWKSet(provider.jwks, {
    async [customFetch](url, options) {
      const response = await providerFetch(url, options)
      if (response.status !== 200) throw new LoginFailure('unavailable')
      return response
    },
  })
  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: config.issuer, audience: config.clientId, algorithms: provider.algorithms,
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'],
    })
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    const subject = subjectSchema.safeParse(payload.sub)
    if (!subject.success || typeof payload.nonce !== 'string' || !tokenMatches(payload.nonce, nonce) ||
      typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 30 ||
      audiences.some(audience => audience !== config.clientId) ||
      ((audiences.length > 1 || payload.azp !== undefined) && payload.azp !== config.clientId)) throw new LoginFailure('failed')
    return subject.data
  } catch (error) {
    if (error instanceof LoginFailure) throw error
    throw new LoginFailure(error instanceof joseErrors.JWKSTimeout ? 'unavailable' : 'failed')
  }
}

function groupClaim(profile: Record<string, unknown>, claim: string) {
  if (Object.hasOwn(profile, claim)) return profile[claim]
  let current: unknown = profile
  for (const key of claim.split('.')) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

async function userIdentity(config: IdentityConfig, provider: Awaited<ReturnType<typeof discover>>, code: string, flow: Flow): Promise<VerifiedIdentity> {
  const tokens = await exchangeCode(config, provider, code, flow.verifier)
  const subject = await verifyToken(config, provider, tokens.id_token, flow.nonce)
  const profile = z.record(z.string(), z.unknown()).safeParse(await providerJson(provider.userinfo, {
    headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' },
  }))
  if (!profile.success || profile.data.sub !== subject) throw new LoginFailure('failed')
  const groups = groupSchema.safeParse(groupClaim(profile.data, config.groupsClaim))
  const displayName = displayNameSchema.safeParse(profile.data.name)
  const username = displayNameSchema.safeParse(profile.data.preferred_username)
  return {
    issuer: config.issuer, subject, groups: groups.success ? [...new Set(groups.data)] : [],
    displayName: displayName.success ? displayName.data : username.success ? username.data : 'Benutzer',
  }
}

export async function oidc(event: H3Event) {
  const config = event.context.identityConfig
  if (!config) return redirect('/?login=unavailable')
  try {
    const query = getQuery(event)
    const { code, state, iss, error } = query
    if (code === undefined && state === undefined && iss === undefined && error === undefined) {
      const provider = await discover(config)
      return redirect(authorizationUrl(event, config, provider.authorization))
    }
    const flow = readFlow(event, config)
    if (error !== undefined || typeof code !== 'string' || !code || typeof state !== 'string' || !tokenMatches(state, flow.state) ||
      (iss !== undefined && iss !== config.issuer)) throw new LoginFailure('failed')

    const provider = await discover(config)
    if (provider.requireResponseIssuer && iss !== config.issuer) throw new LoginFailure('failed')
    startSession(event, config, await userIdentity(config, provider, code, flow))
    return redirect('/')
  } catch (error) {
    if (!(error instanceof LoginFailure)) console.error('OIDC-Anmeldung fehlgeschlagen', error instanceof Error ? error.name : typeof error)
    return redirect(`/?login=${error instanceof LoginFailure ? error.reason : 'unavailable'}`)
  }
}
