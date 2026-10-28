import { describe, expect, it } from 'vitest'
import { decimalToCents, sumCents } from '../server/modules/finance/money'
import { amountCentsSchema, bookingDateSchema } from '../shared/schemas/finance'
describe('exact money and booking dates', () => {
  it('converts decimals without floating point and keeps large amounts exact', () => {
    expect(decimalToCents('-12,99', ',')).toBe('-1299')
    expect(decimalToCents('0.1')).toBe('10')
    expect(decimalToCents('92233720368547758.07')).toBe('9223372036854775807')
    expect(decimalToCents('-92233720368547758.08')).toBe('-9223372036854775808')
    expect(sumCents(['9007199254740993', '-10'])).toBe('9007199254740983')
  })
  it('rejects malformed, zero and overflowing amounts', () => {
    for (const value of ['0', '-0.00', '1.001', '1e3', '1,000.00', '92233720368547758.08']) expect(() => decimalToCents(value)).toThrow()
    expect(amountCentsSchema.safeParse('9223372036854775808').success).toBe(false)
    expect(() => sumCents(['9223372036854775807', '1'])).toThrow()
  })
  it('checks actual calendar dates', () => {
    expect(bookingDateSchema.safeParse('2024-02-29').success).toBe(true)
    expect(bookingDateSchema.safeParse('2026-02-29').success).toBe(false)
  })
})
