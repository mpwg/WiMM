import { CsvError, parse } from 'csv-parse/sync'
import { bookingDateSchema } from '../../../shared/schemas/finance'
import type { ImportMapping, ImportRow, ImportRowError } from '../../../shared/schemas/imports'
import { decimalToCents } from '../finance/money'
import { ApiError } from '../http-error'

export const MAX_CSV_BYTES = 5 * 1024 * 1024
const maxRows = 5000

function dateForFormat(value: string, format: ImportMapping['dateFormat']) {
  if (format === 'YYYY-MM-DD') return value
  const pattern = format === 'DD.MM.YYYY' ? /^(\d{2})\.(\d{2})\.(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = pattern.exec(value)
  if (!match) return ''
  const [, first, second, year] = match
  return format === 'MM/DD/YYYY' ? `${year}-${first}-${second}` : `${year}-${second}-${first}`
}

function readRecords(data: Uint8Array, mapping: ImportMapping) {
  if (data.byteLength > MAX_CSV_BYTES) throw new ApiError(413, 'payload_too_large', 'Eine CSV-Datei darf höchstens 5 MiB groß sein.')
  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    throw new ApiError(422, 'validation_failed', 'Speichere die CSV-Datei in UTF-8.')
  }
  const headerRows = mapping.hasHeader ? 1 : 0
  // csv-parse's array overload does not describe the records wrapped by info: true.
  const records = parse(decoded, {
    delimiter: mapping.delimiter,
    info: true,
    skip_empty_lines: true,
    relax_column_count: true,
    to: maxRows + headerRows + 1,
  }) as unknown as { record: string[], info: { lines: number } }[]
  if (records.length > maxRows + headerRows) throw new ApiError(413, 'payload_too_large', 'Ein Import darf höchstens 5.000 Buchungszeilen enthalten.')
  return records.slice(headerRows)
}

export function normalizeImport(data: Uint8Array, mapping: ImportMapping, categories: { id: string, name: string }[]) {
  const rows: ImportRow[] = []
  const errors: ImportRowError[] = []
  let records: ReturnType<typeof readRecords>
  try {
    records = readRecords(data, mapping)
  } catch (error) {
    if (!(error instanceof CsvError)) throw error
    errors.push({ row: Number(error.lines) || 1, field: 'csv', message: 'Die CSV-Struktur ist an dieser Stelle ungültig.' })
    return { rows, errors }
  }
  if (!records.length) {
    errors.push({ row: mapping.hasHeader ? 2 : 1, field: 'csv', message: 'Die CSV-Datei enthält keine Buchungszeilen.' })
  }
  const activeIds = new Set(categories.map(category => category.id))
  const categoryNames = new Map<string, string | null>()
  for (const category of categories) {
    categoryNames.set(category.name, categoryNames.has(category.name) ? null : category.id)
  }
  for (const { record, info } of records) {
    const row = info.lines
    const initialErrors = errors.length
    const date = dateForFormat(record[mapping.dateColumn]?.trim() ?? '', mapping.dateFormat)
    if (!bookingDateSchema.safeParse(date).success) {
      errors.push({ row, field: 'date', message: 'Das Datum fehlt oder passt nicht zum gewählten Format.' })
    }
    let amountCents = ''
    try {
      const rawAmount = (record[mapping.amountColumn]?.trim() ?? '').replace(/^\+(?=\d)/, '').replace(/^(-?)0+(?=\d)/, '$1')
      if (rawAmount.length > 21) throw new Error()
      amountCents = decimalToCents(rawAmount, mapping.decimalSeparator)
    } catch {
      errors.push({ row, field: 'amount', message: 'Der Betrag muss in Cent darstellbar sein und darf nicht null sein.' })
    }
    const description = record[mapping.descriptionColumn]?.trim()
    if (description === undefined || description.length > 2000) {
      errors.push({ row, field: 'description', message: 'Die Beschreibungsspalte fehlt oder enthält mehr als 2.000 Zeichen.' })
    }
    let categoryId = null
    if (mapping.categoryColumn !== undefined) {
      const label = record[mapping.categoryColumn]?.trim()
      const explicit = label !== undefined && mapping.categoryMapping && Object.hasOwn(mapping.categoryMapping, label)
      const selection = explicit ? mapping.categoryMapping![label!] : label ? categoryNames.get(label) ?? undefined : null
      if (label === undefined || selection === undefined || (selection !== null && !activeIds.has(selection))) {
        errors.push({
          row, field: 'category', value: label || undefined,
          message: label ? `Ordne „${label.slice(0, 120)}“ einer aktiven Kategorie zu.` : 'Die gewählte Kategoriespalte fehlt.',
        })
      } else {
        categoryId = selection
      }
    }
    if (errors.length === initialErrors) rows.push({ row, date, amountCents, description: description!, categoryId })
  }
  return { rows, errors }
}
