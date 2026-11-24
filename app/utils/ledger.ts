import type { Role } from '~~/shared/schemas/access'
import type { BookingInput } from '~~/shared/schemas/finance'
import type { ReceiptMetadata } from '~~/shared/schemas/receipts'

export type { BookingInput } from '~~/shared/schemas/finance'
export type { ImportPreview } from '~~/shared/schemas/imports'
export type { ReceiptMetadata as Receipt } from '~~/shared/schemas/receipts'

export interface Workspace {
  id: string
  name: string
  role: Role
  currency: 'EUR'
}

export interface Session {
  user: { id: string; displayName: string }
  csrfToken: string
  workspaces: Workspace[]
}

export interface Resource {
  id: string
  name: string
  archived: boolean
}

export interface Booking extends BookingInput {
  id: string
  version: number
}

export interface BookingDetail extends Booking {
  receipts: ReceiptMetadata[]
}

export interface BookingPage {
  items: Booking[]
  nextCursor: string | null
}

export interface Summary {
  incomeCents: string
  expenseCents: string
  balanceCents: string
}

export interface Problem {
  status: number
  code: string
  message: string
  fields?: Record<string, string | string[]>
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown> | FormData
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface WorkspaceApi {
  base: string
  request: <T>(path: string, options?: RequestOptions) => Promise<T>
  download: (path: string, name: string) => Promise<void>
}

export function readProblem(error: unknown): Problem {
  const failure = error as {
    status?: number
    statusCode?: number
    data?: { error?: Partial<Problem> }
  } | null
  const status = failure?.status ?? failure?.statusCode ?? 0
  const server = failure?.data?.error
  const messages: Record<number, string> = {
    0: 'Keine Verbindung zum Server. Prüfe deine Verbindung und versuche es erneut.',
    401: 'Deine Sitzung ist abgelaufen. Melde dich erneut an.',
    403: 'Du hast für diese Aktion keine Berechtigung.',
    404: 'Dieser Eintrag ist nicht mehr verfügbar.',
    409: 'Der Eintrag wurde inzwischen geändert.',
    410: 'Die Importvorschau ist abgelaufen. Erstelle eine neue Vorschau.',
    413: 'Die Datei ist zu groß.',
    415: 'Dieses Dateiformat wird nicht unterstützt.',
    422: 'Prüfe deine Eingaben.',
    503: 'Der Server ist gerade ausgelastet. Versuche es erneut.',
  }
  return {
    status,
    code: server?.code ?? '',
    message: server?.message ?? messages[status] ?? 'Die Anfrage konnte nicht abgeschlossen werden.',
    fields: server?.fields,
  }
}

export function uncertainWrite(problem: Problem) {
  return problem.status === 0 || problem.status >= 500
}

export function writeProblem(error: unknown): Problem {
  const problem = readProblem(error)
  return uncertainWrite(problem)
    ? { ...problem, message: 'Der Server hat den Ausgang der Änderung nicht bestätigt. Prüfe den aktuellen Stand, bevor du es erneut versuchst.' }
    : problem
}

export function workspaceApi(workspace: Workspace, session: Session, onUnauthorized: (problem: Problem) => void, isCurrent: () => boolean): WorkspaceApi {
  const base = `/api/workspaces/${workspace.id}`
  const identity = new AbortController()
  const abort = () => identity.abort()
  onScopeDispose(abort)

  async function response(path: string, options: RequestOptions = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value))
    }
    const headers = new Headers(options.headers)
    if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', session.csrfToken)
    let body: BodyInit | undefined
    if (options.body instanceof FormData) body = options.body
    else if (options.body) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
    const signal = options.signal
      ? AbortSignal.any([identity.signal, options.signal])
      : identity.signal
    const target = base + path + (query.size ? '?' + query.toString() : '')
    const result = await fetch(target, { method: options.method, body, headers, cache: 'no-store', signal })
    if (!isCurrent() || signal.aborted) throw new DOMException('Veraltete Anfrage', 'AbortError')
    if (result.ok) return result

    const data: unknown = await result.json().catch(() => null)
    const error = Object.assign(new Error(result.statusText), { status: result.status, data })
    if (result.status === 401 && isCurrent() && !signal.aborted) onUnauthorized(readProblem(error))
    throw error
  }

  return {
    base,
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      const result = await response(path, options)
      return (result.status === 204 ? undefined : await result.json()) as T
    },
    async download(path, name) {
      const result = await response(path)
      const blob = await result.blob()
      if (!isCurrent() || identity.signal.aborted) return
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = name
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  }
}

const moneyFormatter = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
const shortDateFormatter = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const timeFormatter = new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short' })
const sizeFormatter = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 })

export function formatMoney(cents: string) {
  const value = BigInt(cents)
  const units = value / 100n
  const decimal = ((value < 0n ? -value : value) % 100n).toString().padStart(2, '0')
  return moneyFormatter.formatToParts(value < 0n && units === 0n ? -0 : units)
    .map(part => part.type === 'fraction' ? decimal : part.value).join('')
}

export function formatDate(date: string) {
  return shortDateFormatter.format(new Date(`${date}T00:00:00Z`))
}

export function formatTimestamp(time: number) {
  return timeFormatter.format(time)
}

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${sizeFormatter.format(Math.ceil(bytes / 1024))} KiB`
    : `${sizeFormatter.format(bytes / (1024 * 1024))} MiB`
}

export function today() {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(part => String(part).padStart(2, '0')).join('-')
}

export function inputMoney(cents: string) {
  const value = BigInt(cents)
  const absolute = value < 0n ? -value : value
  return `${absolute / 100n},${(absolute % 100n).toString().padStart(2, '0')}`
}

export function parseMoney(input: string, expense: boolean) {
  const match = /^(\d{1,17})(?:[,.](\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  const magnitude = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  const cents = expense ? -magnitude : magnitude
  const minimum = -(1n << 63n)
  const maximum = (1n << 63n) - 1n
  return cents !== 0n && cents >= minimum && cents <= maximum ? cents.toString() : null
}
