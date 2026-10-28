import { z } from 'zod'

export const MIN_CENTS = -(1n << 63n)
export const MAX_CENTS = (1n << 63n) - 1n
export const amountCentsSchema = z.string().regex(/^-?(0|[1-9]\d{0,18})$/).refine(value => {
  const cents = BigInt(value)
  return cents !== 0n && cents >= MIN_CENTS && cents <= MAX_CENTS
}, 'Betrag liegt außerhalb des erlaubten Bereichs oder ist null.')
export const bookingDateSchema = z.iso.date()
export const bookingInputSchema = z.object({
  accountId: z.uuid(), categoryId: z.uuid().nullable(), date: bookingDateSchema,
  amountCents: amountCentsSchema, description: z.string().trim().max(2000),
}).strict()
