import { z } from 'zod'

const column = z.int().nonnegative()
export const importMappingSchema = z.object({
  accountId: z.uuid(),
  dateColumn: column,
  amountColumn: column,
  descriptionColumn: column,
  categoryColumn: column.optional(),
  categoryMapping: z.record(z.string().min(1), z.uuid().nullable()).optional(),
  hasHeader: z.boolean(),
  delimiter: z.enum([',', ';', '\t']),
  decimalSeparator: z.enum([',', '.']),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD.MM.YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY']),
}).strict().refine(mapping => {
  const columns = [mapping.dateColumn, mapping.amountColumn, mapping.descriptionColumn, mapping.categoryColumn]
  return new Set(columns).size === columns.length
}, { path: ['dateColumn'], message: 'Wähle für jedes Feld eine eigene Spalte.' })

export type ImportMapping = z.infer<typeof importMappingSchema>
export type ImportRow = { row: number, date: string, amountCents: string, description: string, categoryId: string | null }
export type ImportRowError = { row: number, field: string, message: string, value?: string }
export type ImportPreview = {
  id: string
  accountId: string
  status: 'preview' | 'confirmed'
  expiresAt: number
  rows: ImportRow[]
  errors: ImportRowError[]
  duplicate: boolean
  result: string[] | null
}
