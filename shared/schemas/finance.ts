import { z } from 'zod'

export const MIN_CENTS = -(1n << 63n)
export const MAX_CENTS = (1n << 63n) - 1n
export const amountCentsSchema = z.string().regex(/^-?(0|[1-9]\d{0,18})$/).pipe(z.string().refine(value => {
  const cents = BigInt(value)
  return cents !== 0n && cents >= MIN_CENTS && cents <= MAX_CENTS
}, 'Betrag liegt außerhalb des erlaubten Bereichs oder ist null.'))
export const bookingDateSchema = z.iso.date()
export const bookingInputSchema = z.object({
  accountId: z.uuid(), categoryId: z.uuid().nullable(), date: bookingDateSchema,
  amountCents: amountCentsSchema, description: z.string().trim().max(2000),
}).strict()

export type BookingInput = z.infer<typeof bookingInputSchema>
export const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)
export const bookingUpdateSchema = bookingInputSchema.extend({ version: versionSchema })
export const resourceNameSchema = z.string().trim().min(1).max(120)
export const resourceCreateSchema = z.strictObject({ name: resourceNameSchema })
export const resourceUpdateSchema = z.strictObject({
  name: resourceNameSchema.optional(),
  archived: z.literal(true).optional(),
}).refine(value => value.name !== undefined || value.archived !== undefined, 'Bitte eine Änderung angeben.')

export const bookingFiltersSchema = z.strictObject({
  from: bookingDateSchema.optional(),
  to: bookingDateSchema.optional(),
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
}).refine(value => !value.from || !value.to || value.from <= value.to,
  { message: 'Das Enddatum muss am oder nach dem Startdatum liegen.', path: ['to'] })
export const bookingListSchema = bookingFiltersSchema.safeExtend({
  limit: z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.number().max(200)).optional(),
  cursor: z.string().min(1).max(100).optional(),
})
export type BookingFilters = z.infer<typeof bookingFiltersSchema>
