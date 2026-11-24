import { isReceiptKey } from '../receipts/files'

export const manifestEntry = 'manifest.json'
export const databaseEntry = 'wimm.sqlite'
export const receiptEntry = (storageKey: string) => `receipts/${storageKey}`

const blockSize = 512
const decoder = new TextDecoder()
const isZeroBlock = (block: Uint8Array) => block.every(byte => byte === 0)

function headerText(header: Uint8Array, from: number, to: number) {
  const field = header.subarray(from, to)
  const end = field.indexOf(0)
  return decoder.decode(end === -1 ? field : field.subarray(0, end))
}

function octalField(header: Uint8Array, from: number, to: number) {
  const value = headerText(header, from, to).trim()
  return /^[0-7]+$/.test(value) ? Number.parseInt(value, 8) : NaN
}

function isAllowedPath(path: string) {
  return path === manifestEntry || path === databaseEntry || (path.startsWith('receipts/') && isReceiptKey(path.slice('receipts/'.length)))
}

// Backups are uncompressed ustar files with regular entries and short, fixed names.
// Inspect raw headers before looking at their payloads so links, duplicate names and
// path extensions cannot be silently normalized or omitted by an archive reader.
export function readBackupEntries(archive: Uint8Array) {
  if (archive.byteLength % blockSize !== 0) throw new Error('Das TAR-Archiv ist unvollständig.')
  const files = new Map<string, Uint8Array>()
  for (let offset = 0; offset + blockSize <= archive.byteLength;) {
    const header = archive.subarray(offset, offset + blockSize)
    if (isZeroBlock(header)) {
      if (archive.byteLength - offset >= 2 * blockSize && isZeroBlock(archive.subarray(offset))) return files
      break
    }
    const type = header[156]
    const path = headerText(header, 0, 100)
    if (headerText(header, 257, 263) !== 'ustar' || !isZeroBlock(header.subarray(345, 500))
      || (type !== 0 && type !== 0x30) || !isAllowedPath(path) || files.has(path)) {
      throw new Error('Ungültiger oder doppelter Archivpfad.')
    }
    let checksum = 0
    for (let index = 0; index < blockSize; index++) checksum += index >= 148 && index < 156 ? 32 : header[index]!
    const size = octalField(header, 124, 136)
    if (checksum !== octalField(header, 148, 156) || !Number.isSafeInteger(size)) break
    const start = offset + blockSize
    const end = start + size
    const next = start + Math.ceil(size / blockSize) * blockSize
    if (next > archive.byteLength || !isZeroBlock(archive.subarray(end, next))) break
    files.set(path, archive.subarray(start, end))
    offset = next
  }
  throw new Error('Das TAR-Archiv ist beschädigt oder unvollständig.')
}
