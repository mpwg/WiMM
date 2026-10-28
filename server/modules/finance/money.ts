import { MAX_CENTS, MIN_CENTS } from '../../../shared/schemas/finance'

export function decimalToCents(value: string, separator: '.' | ',' = '.'): string {
  const escaped = separator === '.' ? '\\.' : ','
  const match = new RegExp(`^(-?)([0-9]+)(?:${escaped}([0-9]{1,2}))?$`).exec(value)
  if (!match) throw new Error('Invalid decimal amount')
  const cents = BigInt(match[2]!) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))
  const signed = match[1] ? -cents : cents
  if (signed === 0n || signed < MIN_CENTS || signed > MAX_CENTS) throw new Error('Amount out of range')
  return signed.toString()
}

export function sumCents(values: Iterable<string>): string {
  let total = 0n
  for (const value of values) total += BigInt(value)
  if (total < MIN_CENTS || total > MAX_CENTS) throw new Error('Sum out of range')
  return total.toString()
}
