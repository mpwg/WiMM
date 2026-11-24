import { closeSync, constants, fstatSync, fsyncSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReceiptMetadata } from '../../../shared/schemas/receipts'

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
const keyPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const jpeg = Buffer.from([0xff, 0xd8, 0xff])
const pdf = Buffer.from('%PDF-')

export function isReceiptKey(key: string) {
  return keyPattern.test(key)
}

export function receiptPaths(root: string, key: string) {
  if (!isReceiptKey(key)) throw new Error('Ungültiger Belegschlüssel im Dateispeicher.')
  return { ready: join(root, key), pending: join(root, `${key}.upload`) }
}

export function detectReceiptType(bytes: Uint8Array): ReceiptMetadata['mediaType'] | undefined {
  const header = Buffer.from(bytes.subarray(0, png.length))
  if (header.subarray(0, pdf.length).equals(pdf)) return 'application/pdf'
  if (header.subarray(0, jpeg.length).equals(jpeg)) return 'image/jpeg'
  if (header.equals(png)) return 'image/png'
}

export function syncDirectory(path: string) {
  const file = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try { fsyncSync(file) } finally { closeSync(file) }
}

export function writePrivateFile(path: string, bytes: Uint8Array | string) {
  const file = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(file, bytes)
    fsyncSync(file)
  } finally {
    closeSync(file)
  }
}

function openCheckedReceipt(path: string, size: number, expectedType: string) {
  let file: number
  try {
    file = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ELOOP') return
    throw error
  }
  let checked = false
  try {
    const stats = fstatSync(file)
    if (!stats.isFile() || stats.size !== size || size > MAX_RECEIPT_BYTES) return
    const header = Buffer.alloc(8)
    const read = readSync(file, header, 0, header.length, 0)
    if (detectReceiptType(header.subarray(0, read)) !== expectedType) return
    checked = true
    return file
  } finally {
    if (!checked) closeSync(file)
  }
}

export function isStoredReceipt(path: string, size: number, mediaType: string) {
  const file = openCheckedReceipt(path, size, mediaType)
  if (file === undefined) return false
  closeSync(file)
  return true
}

export function readStoredReceipt(path: string, size: number, mediaType: string) {
  const file = openCheckedReceipt(path, size, mediaType)
  if (file === undefined) throw new Error('Beleg fehlt oder ist beschädigt.')
  try {
    const bytes = readFileSync(file)
    if (bytes.byteLength !== size) throw new Error('Beleggröße hat sich geändert.')
    return bytes
  } finally {
    closeSync(file)
  }
}
