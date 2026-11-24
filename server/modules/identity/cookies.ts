import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import type { IdentityConfig } from '../../config'

const cookies = {
  flow: { name: 'wimm_oidc', path: '/auth/oidc' },
  session: { name: 'wimm_session', path: '/' },
}
type CookiePurpose = keyof typeof cookies

function cookieOptions(config: IdentityConfig, purpose: CookiePurpose) {
  return { httpOnly: true, secure: config.secure, sameSite: 'lax' as const, path: cookies[purpose].path }
}

export function setIdentityCookie(event: H3Event, config: IdentityConfig, purpose: CookiePurpose, value: string, maxAge: number) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', config.cookieKey, iv, { authTagLength: 16 })
  cipher.setAAD(Buffer.from(`wimm:v1:${purpose}`))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const encoded = [iv, ciphertext, cipher.getAuthTag()].map(part => part.toString('base64url')).join('.')
  setCookie(event, cookies[purpose].name, encoded, { ...cookieOptions(config, purpose), maxAge })
}

export function readIdentityCookie(event: H3Event, config: IdentityConfig, purpose: CookiePurpose): string | undefined {
  const cookie = getCookie(event, cookies[purpose].name)
  if (!cookie || cookie.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie)) return
  const [ivPart, ciphertextPart, tagPart] = cookie.split('.') as [string, string, string]
  const iv = Buffer.from(ivPart, 'base64url')
  const tag = Buffer.from(tagPart, 'base64url')
  if (iv.length !== 12 || tag.length !== 16) return
  try {
    const decipher = createDecipheriv('aes-256-gcm', config.cookieKey, iv, { authTagLength: 16 })
    decipher.setAAD(Buffer.from(`wimm:v1:${purpose}`))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, 'base64url')), decipher.final()]).toString('utf8')
  } catch { return undefined }
}

export function clearIdentityCookie(event: H3Event, config: IdentityConfig, purpose: CookiePurpose) {
  deleteCookie(event, cookies[purpose].name, cookieOptions(config, purpose))
}

export function randomToken() {
  return randomBytes(32).toString('base64url')
}

export function tokenMatches(actual: string | undefined, expected: string) {
  if (!actual) return false
  const value = Buffer.from(actual)
  const reference = Buffer.from(expected)
  return value.length === reference.length && timingSafeEqual(value, reference)
}
