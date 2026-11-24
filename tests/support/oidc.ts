import { createHash, randomUUID } from 'node:crypto'
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'

export const testOidcClientId = 'wimm-test'
export const testOidcClientSecret = 'lokaler-oidc-test-client'
export const testCookiePassword = 'lokales-oidc-test-cookie-kennwort-mit-32-zeichen'

type ProviderProfile = {
  idClaims?: JWTPayload
  groups?: unknown
  userinfoSubject?: string
  signWithWrongKey?: boolean
}

export async function startTestOidcProvider({ port = 0, profile = {} }: { port?: number, profile?: ProviderProfile } = {}) {
  const key = await generateKeyPair('RS256')
  const wrongKey = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(key.publicKey), kid: 'local-test-key', alg: 'RS256', use: 'sig' }
  const codes = new Map<string, { nonce: string, challenge: string, redirectUri: string }>()
  const accessTokens = new Map<string, ProviderProfile>()
  const basicAuth = `Basic ${Buffer.from(`${testOidcClientId}:${testOidcClientSecret}`).toString('base64')}`
  let available = true
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    async fetch(request) {
      if (!available) return new Response(null, { status: 503 })
      const url = new URL(request.url)
      const issuer = url.origin
      switch (url.pathname) {
        case '/.well-known/openid-configuration': return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'],
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
        })
        case '/jwks': return Response.json({ keys: [jwk] })
        case '/authorize': {
          const query = url.searchParams
          const state = query.get('state')
          const nonce = query.get('nonce')
          const challenge = query.get('code_challenge')
          const redirectUri = query.get('redirect_uri')
          if (!state || !nonce || !challenge || !redirectUri || query.get('code_challenge_method') !== 'S256' ||
            query.get('response_type') !== 'code' || query.get('client_id') !== testOidcClientId ||
            !query.get('scope')?.split(' ').includes('openid')) return new Response(null, { status: 400 })
          const code = randomUUID()
          codes.set(code, { nonce, challenge, redirectUri })
          const callback = new URL(redirectUri)
          callback.searchParams.set('code', code)
          callback.searchParams.set('state', state)
          callback.searchParams.set('iss', issuer)
          return Response.redirect(callback)
        }
        case '/token': {
          if (request.method !== 'POST' || request.headers.get('authorization') !== basicAuth) return new Response(null, { status: 401 })
          const form = new URLSearchParams(await request.text())
          const code = form.get('code') ?? ''
          const flow = codes.get(code)
          codes.delete(code)
          const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url')
          if (!flow || flow.challenge !== challenge || flow.redirectUri !== form.get('redirect_uri') ||
            form.get('grant_type') !== 'authorization_code') return new Response(null, { status: 400 })
          const now = Math.floor(Date.now() / 1000)
          const token = await new SignJWT({
            iss: issuer, sub: 'lokaler-benutzer', aud: testOidcClientId, iat: now, exp: now + 300,
            nonce: flow.nonce, ...profile.idClaims,
          }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
            .sign(profile.signWithWrongKey ? wrongKey.privateKey : key.privateKey)
          const accessToken = randomUUID()
          accessTokens.set(accessToken, profile)
          return Response.json({ id_token: token, access_token: accessToken, token_type: 'Bearer', expires_in: 300 })
        }
        case '/userinfo': {
          const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
          const info = accessTokens.get(token)
          accessTokens.delete(token)
          if (!info) return new Response(null, { status: 401 })
          return Response.json({ sub: info.userinfoSubject ?? 'lokaler-benutzer', name: 'Lokaler Benutzer', groups: info.groups })
        }
        default: return new Response(null, { status: 404 })
      }
    },
  })
  return {
    issuer: server.url.origin,
    setProfile(value: ProviderProfile) { profile = value },
    setAvailable(value: boolean) { available = value },
    stop: () => server.stop(true),
  }
}

if (import.meta.main) {
  const provider = await startTestOidcProvider({
    port: Number(process.env.WIMM_TEST_OIDC_PORT ?? '3031'),
    profile: { groups: (process.env.WIMM_TEST_OIDC_GROUPS ?? 'wimm-haushalt-owner').split(',') },
  })
  console.log(`Lokaler OIDC-Testprovider auf ${provider.issuer}`)
}
